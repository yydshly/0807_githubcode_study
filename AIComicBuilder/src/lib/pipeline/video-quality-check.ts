import type { TextOptions } from "@/lib/ai/types";
import { extractJSON } from "@/lib/ai/ai-sdk";

interface QualityResult {
  pass: boolean;
  score: number; // 0-100
  issues: string[];
}

const QUALITY_CHECK_PROMPT = `分析此生成的视频帧的质量问题。评分 0-100。

检查项目：
1. 面部完整性（无变形、比例正确、面部特征自然）
2. 肢体完整性（手指数量正确、姿势自然、无多余肢体）
3. 视觉连贯性（无伪影、无故障、无物体穿模/融合）
4. 整体图像质量（清晰度、光照合理、无色带）

如果提供了参考帧（第二张图像），还需检查：
5. 角色与参考的一致性（相似的面部、服装、发型）

仅输出有效 JSON（不使用 markdown，不使用代码块）：
{"score": <0-100 的数字>, "issues": ["<问题描述>", ...], "pass": <布尔值>}

评分 >= 60 为通过。仅在出现严重视觉缺陷时判定不通过，如面部变形、肢体缺失/多余或严重伪影。`;

export async function checkVideoQuality(
  provider: { generateText: (prompt: string, options?: TextOptions) => Promise<string> },
  videoFrameUrl: string,
  referenceFrameUrl?: string
): Promise<QualityResult> {
  try {
    const result = await provider.generateText(QUALITY_CHECK_PROMPT, {
      videos: [videoFrameUrl],
      ...(referenceFrameUrl && { images: [referenceFrameUrl] }),
    });

    const jsonText = extractJSON(result);
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        pass: false,
        score: 0,
        issues: ["Video quality check returned invalid JSON; manual review is required."],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      pass: parsed.pass ?? parsed.score >= 60,
      score: parsed.score ?? 0,
      issues: parsed.issues ?? [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Generation remains best-effort, but a failed review must never masquerade
    // as a perfect score.
    return {
      pass: false,
      score: 0,
      issues: [`Video quality check unavailable: ${message}`],
    };
  }
}
