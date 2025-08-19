import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { Messages } from "@langchain/langgraph";
import { execSync } from 'child_process';
import { z } from "zod";
import fetch from "node-fetch";
import axios from "axios";

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
  roles: string[];
  assertionToken: string;
}) {
  console.log("AGENT: Received prompt", params);

  const sshCommandTool = tool(
    async ({ username, sshCommand}) => {

      const body = { roles: params.roles };
      const response = await fetch("http://127.0.0.1:8080/ssh-config", {
        method: "post",
        body: JSON.stringify(body),
        headers: {
          "Authorization": `Bearer ${params.assertionToken}`,
        }
      });

      const data = await response.json() as { path: string };

      const path = data.path;

      return execSync(`ssh -F ${path} ${username}@quotes.mwihack.cloud.gravitational.io ${sshCommand}`).toString()
    }, {
      schema: sshCommandSchema,
      name: "run_ssh_command",
      description: "Runs a command on a remote server via SSH using the user you specify.",
    }
  )

  const getQuoteTool = tool(
    async () => {
      const body = { roles: params.roles, application: "quotes" };

      const socketResponse = await axios({
        method: "post",
        url: "http://127.0.0.1:8080/application-tunnel",
        data: JSON.stringify(body),
        headers: {
          "Authorization": `Bearer ${params.assertionToken}`,
        }
      });

      const data = await socketResponse.data as { id: string, address: string, expires: string };

      let socketPath = data.address;

      socketPath = socketPath.replace("unix://", "");

      const quoteResponse = await axios({
        url: "http://quotes.mwihack.cloud.gravitational.io/api/quotes/random",
        socketPath,
        method: "get"
      });

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
