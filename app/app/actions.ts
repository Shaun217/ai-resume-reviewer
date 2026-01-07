"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// 初始化客户端
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 使用 Service Role Key 以确保后端写入权限，避开 RLS 导致的中断
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function analyzeResume({ resumeText, fileData, position, jobRequirements, userId }: any) {
  // 1. 指定使用 gemini-2.5-flash
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // 2. 深度优化的 Prompt：强制要求 JSON，并提取核心联系信息
  const prompt = `
    你是一名资深的 HR 专家。请对以下简历内容进行多维度评估。
    【对标岗位】：${position}
    【岗位要求】：${jobRequirements}

    请提取候选人信息并给出评估，必须严格按照以下 JSON 格式返回，不要包含 Markdown 标签或任何多余文字：
    {
      "name": "候选人真实姓名",
      "email": "联系邮箱",
      "phone": "联系电话",
      "hire_recommendation": "yes 或 no (高度匹配则为 yes)",
      "highlights": ["亮点1", "亮点2", "亮点3"],
      "risks": ["风险1", "风险2"]
    }
    如果简历中某项信息不存在，请填写 "未提取"。
  `;

  try {
    let result;

    if (fileData) {
      // 🚀 处理多模态输入 (PDF/图片)
      // 分离 Base64 的 MIME 类型和数据部分
      const mimeType = fileData.split(";")[0].split(":")[1] || "application/pdf";
      const base64Data = fileData.split(",")[1];

      result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ]);
    } else {
      // 处理纯文本粘贴
      result = await model.generateContent([resumeText, prompt]);
    }

    const responseText = result.response.text();

    // 3. 增强版 JSON 提取逻辑：精准捕捉 { ... } 之间的内容
    let analysisResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI 未返回有效的 JSON 结构");
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Gemini 原始返回内容:", responseText);
      throw new Error("JSON 解析失败：AI 返回格式异常");
    }

    // 4. 将结果同步至 Supabase
    const { error: dbError } = await supabase.from("jobs").insert([
      {
        user_id: userId,
        position: position,
        // 如果是文件解析，存入占位符，避免 Textarea 文本过大导致数据库负载
        resume_text: resumeText || `[Document File Analysis: ${position}]`,
        result: analysisResult,
        created_at: new Date().toISOString()
      },
    ]);

    if (dbError) {
      console.error("数据库写入失败:", dbError);
      throw new Error("结果保存至数据库时出错");
    }

    return analysisResult;

  } catch (err: any) {
    console.error("分析流程中断:", err.message);
    throw new Error(err.message || "分析任务失败");
  }
}