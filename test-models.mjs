import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const result = await genAI.listModels();
    console.log("\n=== 可用模型列表及方法 ===\n");
    
    result.models.forEach((model) => {
      console.log(`ID: ${model.name}`);
      console.log(`显示名称: ${model.displayName}`);
      console.log(`支持方法: ${model.supportedGenerationMethods.join(", ")}`);
      console.log("-----------------------------------");
    });
  } catch (error) {
    console.error("无法获取列表，请检查 API Key 或网络代理:", error.message);
  }
}

// 使用顶层 await，确保 Node 进程在请求完成前不会退出
await listModels();
