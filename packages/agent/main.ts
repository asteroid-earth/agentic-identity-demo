import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { Messages} from "@langchain/langgraph";
import { execSync } from 'child_process';

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  maxOutputTokens: 2048,
});

const sshCommandTool = tool(
  async ( sshCommand: string ) => {
    return execSync(`ssh -F /opt/machine-id/ssh_config ubuntu@quotes.mwihack.cloud.gravitational.io ${sshCommand}`).toString()
  }, {
    name: "run_ssh_command",
    description: "Runs a command on a remote server via SSH.",
  }
)

const agent = createReactAgent({
  llm,
  tools: [sshCommandTool],
});

export async function prompt(params: {
  prompt: string;
  roles: string[];
  assertionToken: string;
}) {
  console.log("AGENT: Received prompt", params);

  const messages: Messages = [{role: "user", content: params.prompt}];

  const response = await agent.invoke({messages});

  const lastMessageIndex = response.messages.length - 1;

  return response.messages[lastMessageIndex].content
}
