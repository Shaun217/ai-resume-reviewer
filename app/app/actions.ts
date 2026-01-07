"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// 初始化 Gemini 与 Supabase (使用 Service Role 以确保写入权限)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function analyzeResume({ resumeText, fileData, position, jobRequirements, userId }: any) {
  // 1. 指定使用最新的 gemini-2.5-flash 模型
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // 2. 深度优化的系统提示词 (HR 专家角色 + 结构化提取)
  const prompt = `
    你是一名资深的 HR 专家。请对以下简历进行深度评估并提取关键信息。
    
    【对标岗位】：${position}
    【岗位要求】：${jobRequirements}

    请必须严格按照以下 JSON 格式返回结果，严禁包含任何 Markdown 代码块（如 \`\`\`json）或额外解释说明：
    {
      "name": "提取到的候选人姓名",
      "email": "邮箱地址",
      "phone": "联系电话",
      "hire_recommendation": "填写 'yes' 或 'no' (若候选人核心技能与岗位要求高度匹配则为 yes)",
      "highlights": ["核心匹配亮点1", "核心匹配亮点2", "核心匹配亮点3"],
      "risks": ["潜在缺失技能或职业风险1", "潜在风险2"]
    }
    
    注意：如果简历中未找到姓名、邮箱或电话，请在该字段填写 "未提取"。
  `;

  try {
    let result;

    if (fileData) {
      // 🚀 多模态处理：直接将 Base64 文件流发给 Gemini
      // 处理 Data URL 格式 (data:application/pdf;base64,xxxx)
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
      // 纯文本处理：处理粘贴的内容
      result = await model.generateContent([resumeText, prompt]);
    }

    const responseText = result.response.text();
    
    // 3. 稳健的 JSON 解析逻辑 (移除可能存在的 Markdown 标签)
    const cleanedJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysisResult = JSON.parse(cleanedJson);

    // 4. 将分析结果与原始文本存入 Supabase
    // 注意：如果是文件上传，resume_text 会标记为 [File Analysis]
    const { error } = await supabase.from("jobs").insert([
      {
        user_id: userId,
        position: position,
        resume_text: resumeText || "[PDF/Document File Analysis]",
        result: analysisResult,
        created_at: new Date().toISOString()
      },
    ]);

    if (error) throw error;

    return analysisResult;
  } catch (err) {
    console.error("Gemini Analysis Error:", err);
    throw new Error("AI 分析失败，请检查 API 状态或文件内容");
  }
}