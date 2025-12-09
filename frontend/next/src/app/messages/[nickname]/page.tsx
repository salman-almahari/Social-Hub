"use client";
import { useParams } from "next/navigation";
import { Messages } from "../messages";

export default function MessagePage() {
  const params = useParams();
  const targetNickname = params.nickname as string;

  return <Messages targetNickname={targetNickname} />;
} 