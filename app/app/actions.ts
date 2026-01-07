"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function analyzeResume({ resumeText, position, jobRequirements, userId }: any) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    你是一名资深的 HR 专家。请对以下简历文本进行深度评估。
    【对标岗位】：${position}
    【岗位要求】：${jobRequirements}

    请提取候选人信息并给出评估，必须严格以 JSON 格式返回，严禁包含 Markdown 标签或其它文字：
    {
      "name": "候选人姓名",
      "email": "邮箱",
      "phone": "电话",
      "hire_recommendation": "yes 或 no",
      "highlights": ["亮点1", "亮点2", "亮点3"],
      "risks": ["风险1", "风险2"]
    }
    若信息不存在则填 "未提取"。

    简历文本内容如下：
    ${resumeText}
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 强力 JSON 提取，确保不因 AI 的多余文字报错
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 返回格式异常");
    const analysisResult = JSON.parse(jsonMatch[0]);

    // 存入数据库
    const { error } = await supabase.from("jobs").insert([
      {
        user_id: userId,
        position: position,
        resume_text: resumeText.slice(0, 5000), // 限制长度防止数据库报错
        result: analysisResult,
      },
    ]);

    if (error) throw error;
    return analysisResult;
  } catch (e) {
    console.error(e);
    throw new Error("分析失败，请检查文本内容");
  }
}