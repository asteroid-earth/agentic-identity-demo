import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { Messages } from "@langchain/langgraph";
import { execSync } from 'child_process';
import { z } from "zod";
import axios from "axios";
import fs from 'fs/promises';

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  maxOutputTokens: 2048,
});

const systemPrompt = "You are a helpful assistant to DevOps and Platform Engineers. When running SSH commands, use the 'ubuntu' user unless otherwise specified.";

const sshCommandSchema = z.object({
  username: z.string().describe("The username to attempt to login as via the SSH connection. Unless otherwise specified, use 'ubuntu'."),
  sshCommand: z.string().describe("The command to run on the remote server."),
});

export async function prompt(params: {
  prompt: string;
}) {
  console.log("AGENT: Received prompt", params);

  const logDebug = async (data: any) => {
    const logEntry = `${new Date().toISOString()}: ${JSON.stringify(data, null, 2)}\n`;
    await fs.appendFile(`${__dirname}/langgraph-debug.log`, logEntry);
  };

  const sshCommandTool = tool(
    async (sshCommand) => {

      const path = process.env.SSH_CONFIG_PATH;

      return execSync(`ssh -F ${path} ubuntu@agent-demo-target.mwidemo.cloud.gravitational.io ${sshCommand}`).toString()
    }, {
      schema: sshCommandSchema,
      name: "run_ssh_command",
      description: "Runs a command on a remote server via SSH using the user you specify.",
    }
  )

  const getQuoteTool = tool(
    async () => {

      const url = "http://localhost:3000/api/quotes/random";

      const quoteResponse = await axios({
        url,
      });

      logDebug(quoteResponse.data)

      return await quoteResponse.data
    },
    {
      name: "get_quote",
      description: "Gets a random quote from a remote application, along with the quote's category and status.",
    }
  );

  const agent = createReactAgent({
    llm,
    tools: [sshCommandTool, getQuoteTool],
    prompt: systemPrompt,
  });

  const messages: Messages = [{role: "user", content: params.prompt}];

  const response = await agent.invoke({messages});

  const lastMessageIndex = response.messages.length - 1;

  return response.messages[lastMessageIndex].content
}
