#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抖音视频生成器（异步版）

用途：
1. 从研报 JSON 中提取「投资要点」「结论」作为口播文案；
2. 用 edge-tts 生成中文语音；
3. 用 moviepy 将研报图表拼接为视频画面，并叠加背景音乐；
4. 输出 MP4 文件，失败时自动降级为“外部 AI 视频工具可用提示词”。

说明：
- 该脚本适合挂到 Cloudflare Queue 消费者、GitHub Actions 或其他异步任务执行器。
- 在“纯 Vercel + Supabase + Cloudflare”架构中，建议把 MP4 渲染放到异步任务里执行，
  避免 Vercel 函数超时；页面侧优先返回 taskId 轮询状态。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import tempfile
import textwrap
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import edge_tts  # type: ignore
except Exception:  # pragma: no cover
    edge_tts = None

try:
    import aiohttp  # type: ignore
except Exception:  # pragma: no cover
    aiohttp = None

try:
    from moviepy.audio.fx.all import audio_loop  # type: ignore
    from moviepy.editor import (  # type: ignore
        AudioFileClip,
        CompositeAudioClip,
        ImageClip,
        concatenate_videoclips,
    )
except Exception:  # pragma: no cover
    AudioFileClip = None
    CompositeAudioClip = None
    ImageClip = None
    concatenate_videoclips = None
    audio_loop = None


@dataclass
class VideoGenerationOutput:
    mode: str  # mp4 / prompt
    mp4_path: Optional[str] = None
    prompt: Optional[Dict[str, Any]] = None
    logs: List[str] = field(default_factory=list)


def _load_report(path: Path) -> Dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("报告 JSON 顶层必须是对象")
    return data


def _section_text(report: Dict[str, Any], title: str) -> str:
    sections = report.get("sections") or []
    if not isinstance(sections, list):
        return ""
    for section in sections:
        if isinstance(section, dict) and str(section.get("title", "")).strip() == title:
            return str(section.get("content", "")).strip()
    return ""


def _extract_voiceover_text(report: Dict[str, Any]) -> str:
    key_points = _section_text(report, "投资要点")
    conclusion = _section_text(report, "结论")
    risk = _section_text(report, "风险")
    text = f"投资要点：{key_points}。结论：{conclusion}。风险提示：{risk}。"
    # 控制口播长度，避免 TTS 过长导致渲染时间和成本升高
    return textwrap.shorten(text.replace("\n", " "), width=680, placeholder="……")


def _extract_chart_sources(report: Dict[str, Any], max_count: int = 9) -> List[str]:
    charts = report.get("charts") or []
    if not isinstance(charts, list):
        return []
    sources: List[str] = []
    for chart in charts:
        if not isinstance(chart, dict):
            continue
        candidate = (
            chart.get("imagePath")
            or chart.get("image_path")
            or chart.get("imageUrl")
            or chart.get("image_url")
            or chart.get("path")
            or chart.get("url")
        )
        if candidate:
            sources.append(str(candidate))
        if len(sources) >= max_count:
            break
    return sources


def _build_douyin_prompt(report: Dict[str, Any], fallback_reason: str = "") -> Dict[str, Any]:
    stock = report.get("stock") or {}
    stock_name = stock.get("name") or "该标的"
    stock_code = stock.get("code") or "N/A"
    key_points = _section_text(report, "投资要点") or "请总结该标的近期关键逻辑。"
    conclusion = _section_text(report, "结论") or "请给出中性、审慎结论。"
    risk = _section_text(report, "风险") or "请补充风险提示。"

    storyboard = [
        "镜头1：标题封面（标的名称 + 代码 + 时间）",
        "镜头2：投资要点（配关键指标图）",
        "镜头3：估值与行业比较（配估值图）",
        "镜头4：结论与风险提示（配总结页）",
    ]

    return {
        "title": f"{stock_name}（{stock_code}）机构视角3分钟速览",
        "script": f"投资要点：{key_points}。结论：{conclusion}。风险提示：{risk}。",
        "storyboard": storyboard,
        "hashtags": ["#股票", "#财经", "#投资", "#研报解读", "#资产配置"],
        "fallback_reason": fallback_reason,
    }


async def _edge_tts_to_file(text: str, output_audio: Path, voice: str, rate: str) -> None:
    if edge_tts is None:
        raise RuntimeError("edge-tts 未安装，无法执行 MP4 合成。")
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(str(output_audio))


async def _download_file(url: str, target: Path) -> None:
    if aiohttp is None:
        raise RuntimeError("aiohttp 未安装，无法下载远程图表。")

    timeout = aiohttp.ClientTimeout(total=25)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise RuntimeError(f"下载图表失败: {url} ({response.status})")
            content = await response.read()
            target.write_bytes(content)


async def _materialize_images(sources: List[str], workdir: Path, logs: List[str]) -> List[Path]:
    resolved: List[Path] = []

    async def resolve_one(idx: int, source: str) -> Optional[Path]:
        if source.startswith("http://") or source.startswith("https://"):
            ext = Path(source.split("?")[0]).suffix or ".png"
            out_file = workdir / f"chart_{idx:02d}{ext}"
            try:
                await _download_file(source, out_file)
                return out_file
            except Exception as exc:
                logs.append(f"图表下载失败（忽略）：{source}，原因：{exc}")
                return None

        local = Path(source)
        if local.exists():
            return local

        logs.append(f"图表文件不存在（忽略）：{source}")
        return None

    tasks = [resolve_one(i, s) for i, s in enumerate(sources, start=1)]
    results = await asyncio.gather(*tasks)
    for item in results:
        if item is not None:
            resolved.append(item)
    return resolved


def _render_video_sync(
    images: List[Path],
    audio_path: Path,
    output_path: Path,
    bgm_path: Optional[Path],
    logs: List[str],
) -> None:
    if AudioFileClip is None or ImageClip is None or CompositeAudioClip is None or concatenate_videoclips is None:
        raise RuntimeError("moviepy 未安装，无法执行 MP4 合成。")

    voice = AudioFileClip(str(audio_path))
    if not images:
        raise RuntimeError("没有可用图表，无法合成视频。")

    per_image = max(3.5, voice.duration / len(images))
    slides = []

    for image in images:
        clip = ImageClip(str(image)).set_duration(per_image)
        clip = clip.resize(height=1080).on_color(
            size=(1920, 1080),
            color=(14, 18, 24),
            pos=("center", "center"),
        )
        slides.append(clip)

    video = concatenate_videoclips(slides, method="compose")
    if video.duration < voice.duration:
        # 口播比画面长时，延长最后一张图，避免音画提前结束
        extend = voice.duration - video.duration + 0.2
        slides[-1] = slides[-1].set_duration(slides[-1].duration + extend)
        video = concatenate_videoclips(slides, method="compose")

    tracks = [voice.volumex(1.0)]
    bgm_clip = None
    if bgm_path and bgm_path.exists():
        bgm_clip = AudioFileClip(str(bgm_path))
        if audio_loop is not None:
            bgm_clip = audio_loop(bgm_clip, duration=video.duration)
        tracks.append(bgm_clip.volumex(0.16))
    else:
        logs.append("未配置背景音乐或文件不存在，跳过 BGM。")

    video = video.set_audio(CompositeAudioClip(tracks))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    video.write_videofile(
        str(output_path),
        fps=24,
        codec="libx264",
        audio_codec="aac",
        bitrate="2500k",
        preset="medium",
        threads=2,
        logger=None,
    )

    # 显式释放资源，避免批量任务时句柄泄漏
    video.close()
    voice.close()
    if bgm_clip is not None:
        bgm_clip.close()
    for slide in slides:
        slide.close()


async def generate_video(
    report: Dict[str, Any],
    out_dir: Path,
    mode: str = "mp4",
    bgm_path: Optional[Path] = None,
    voice: str = "zh-CN-XiaoxiaoNeural",
    rate: str = "+8%",
    max_charts: int = 9,
) -> VideoGenerationOutput:
    result = VideoGenerationOutput(mode=mode)

    if mode == "prompt":
        result.prompt = _build_douyin_prompt(report, fallback_reason="用户选择提示词模式")
        return result

    voiceover = _extract_voiceover_text(report)
    if not voiceover:
        result.mode = "prompt"
        result.prompt = _build_douyin_prompt(report, fallback_reason="报告缺少可口播文本")
        return result

    chart_sources = _extract_chart_sources(report, max_count=max_charts)
    if not chart_sources:
        result.mode = "prompt"
        result.prompt = _build_douyin_prompt(report, fallback_reason="报告中未找到图表素材")
        return result

    with tempfile.TemporaryDirectory(prefix="finvideo_") as tmp:
        tmp_dir = Path(tmp)
        audio_file = tmp_dir / "voiceover.mp3"
        try:
            await _edge_tts_to_file(voiceover, audio_file, voice=voice, rate=rate)
        except Exception as exc:
            result.mode = "prompt"
            result.logs.append(f"TTS 生成失败：{exc}")
            result.prompt = _build_douyin_prompt(report, fallback_reason="TTS 失败，自动降级")
            return result

        images = await _materialize_images(chart_sources, tmp_dir, result.logs)
        if not images:
            result.mode = "prompt"
            result.prompt = _build_douyin_prompt(report, fallback_reason="图表解析失败，自动降级")
            return result

        stock_code = str((report.get("stock") or {}).get("code") or "UNKNOWN")
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        out_file = out_dir / f"{stock_code}_{ts}.mp4"

        try:
            await asyncio.to_thread(
                _render_video_sync,
                images,
                audio_file,
                out_file,
                bgm_path,
                result.logs,
            )
            result.mode = "mp4"
            result.mp4_path = str(out_file)
            return result
        except Exception as exc:
            result.mode = "prompt"
            result.logs.append(f"视频合成失败：{exc}")
            result.prompt = _build_douyin_prompt(report, fallback_reason="moviepy 合成失败，自动降级")
            return result


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="基于研报内容生成抖音视频或提示词")
    parser.add_argument("--report-json", required=True, help="研报 JSON 文件路径")
    parser.add_argument("--out-dir", default="./artifacts/videos", help="MP4 输出目录")
    parser.add_argument("--mode", choices=["mp4", "prompt"], default="mp4", help="输出模式")
    parser.add_argument("--bgm", default="", help="背景音乐文件路径（可选）")
    parser.add_argument("--voice", default="zh-CN-XiaoxiaoNeural", help="edge-tts 语音角色")
    parser.add_argument("--rate", default="+8%", help="edge-tts 语速")
    parser.add_argument("--max-charts", type=int, default=9, help="最多使用图表数量")
    parser.add_argument("--result-json", default="", help="将结果 JSON 写入指定文件（可选）")
    return parser.parse_args()


async def _main() -> int:
    args = _parse_args()
    report_file = Path(args.report_json)
    if not report_file.exists():
        raise FileNotFoundError(f"报告文件不存在: {report_file}")

    report = _load_report(report_file)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    bgm = Path(args.bgm) if args.bgm else None

    result = await generate_video(
        report=report,
        out_dir=out_dir,
        mode=args.mode,
        bgm_path=bgm,
        voice=args.voice,
        rate=args.rate,
        max_charts=args.max_charts,
    )

    payload = {
        "mode": result.mode,
        "mp4_path": result.mp4_path,
        "prompt": result.prompt,
        "logs": result.logs,
    }

    text = json.dumps(payload, ensure_ascii=False, indent=2)
    print(text)

    if args.result_json:
        Path(args.result_json).write_text(text, encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))

