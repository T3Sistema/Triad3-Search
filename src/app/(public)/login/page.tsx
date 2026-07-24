import type { Metadata } from "next";
import { LoginPage } from "@/components/pages/login-page";

export const metadata: Metadata = {
  title: "Entrar | Triad3 Search",
};

export default function Page() {
  return <LoginPage />;
}
