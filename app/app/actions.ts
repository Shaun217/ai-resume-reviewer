"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function analyzeResume({ resumeText, fileData, position, jobRequirements, userId }: any) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // 1. 构造多模态输入
  const prompt = `
    你是一名资深的 HR 专家。请对以下简历进行深度评估。
    对标岗位：${position}
    岗位要求：${jobRequirements}

    请提取并分析以下信息，必须严格以 JSON 格式返回，不要包含任何 Markdown 代码块或额外文字：
    {
      "name": "候选人姓名",
      "email": "邮箱地址",
      "phone": "联系电话",
      "hire_recommendation": "yes 或 no (匹配度高则为 yes)",
      "highlights": ["核心匹配点1", "核心匹配点2", "核心匹配点3"],
      "risks": ["潜在风险点1", "潜在风险点2"]
    }
    若某项信息缺失，请填 "未提取"。
  `;

  let result;
  if (fileData) {
    // 处理上传的文件 (Base64)
    const [mimePart, base64Data] = fileData.split(",");
    const mimeType = mimePart.match(/:(.*?);/)?.[1] || "application/pdf";
    
    result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ]);
  } else {
    // 处理粘贴的文本
    result = await model.generateContent([prompt, resumeText]);
  }

  const responseText = result.response.text();
  const analysisResult = JSON.parse(responseText.replace(/```json|```/g, ""));

  // 2. 存入数据库
  const { data, error } = await supabase.from("jobs").insert([
    {
      user_id: userId,
      position: position,
      resume_text: resumeText || "文件上传分析",
      result: analysisResult,
    },
  ]);

  if (error) throw error;
  return analysisResult;
}