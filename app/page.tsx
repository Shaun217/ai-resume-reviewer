// app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  // 逻辑：直接跳转到登录页
  redirect("/login");
  
  // 必须 return null，否则 Next.js 会报错说这不是一个组件
  return null; 
}