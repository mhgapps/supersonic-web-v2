import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    // Simulated AI Response (Replace with OpenAI API call later)
    const aiResponse = `ALI's response to: "${query}"`;

    return NextResponse.json({ reply: aiResponse }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
