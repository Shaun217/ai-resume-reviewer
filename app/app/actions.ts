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
    你是一名资深的 HR 专家。请对以下简历进行评估。
    【对标岗位】：${position}
    【要求】：${jobRequirements}

    请必须严格返回以下 JSON，严禁 Markdown 标签：
    {
      "name": "姓名",
      "email": "邮箱",
      "phone": "电话",
      "hire_recommendation": "yes 或 no", 
      "match_reason": "一句话总结匹配或不匹配的核心原因",
      "highlights": ["亮点1", "亮点2"],
      "risks": ["风险1", "风险2"]
    }
    简历内容：${resumeText}
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 返回格式错误");
    const analysisResult = JSON.parse(jsonMatch[0]);

    const { error } = await supabase.from("jobs").insert([{
      user_id: userId,
      position: position,
      resume_text: resumeText.slice(0, 5000),
      result: analysisResult
    }]);

    if (error) throw error;
    return analysisResult;
  } catch (e) {
    throw new Error("分析失败");
  }
}