import styled from "styled-components";
import "./App.css";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

export function App() {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<
    readonly {
      prompt: string;
      result: string;
      timestamp: Date;
    }[]
  >([]);

  // Used to fetch user data including email/subject
  const { isLoading, isSuccess, data, error } = useQuery({
    queryKey: ["user"],
    queryFn: ({ signal }) => fetchUser(signal),
    staleTime: 0, // Don't cache this query
  });

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (params: Parameters<typeof submitPrompt>[0]) =>
      submitPrompt(params),
    onSuccess: (data) => {
      setHistory((prevHistory) => [
        ...prevHistory,
        {
          prompt,
          result: data.data.result,
          timestamp: new Date(),
        },
      ]);
      setPrompt("");
    },
    onError: (error) => {
      setHistory((prevHistory) => [
        ...prevHistory,
        {
          prompt,
          result: error.message,
          timestamp: new Date(),
        },
      ]);
    },
  });

  // Set the current prompt value
  const handlePromptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setPrompt(event.target.value);
  };

  // Post form data to the api and clear the form on success
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log(prompt);

    await mutateAsync({
      prompt,
    });
  };

  // Whether the submit button is enabled
  const submitEnabled =
    !!prompt && !isPending;

  const fullHistory = (
    isPending
      ? [
          ...history,
          {
            prompt,
            timestamp: new Date(),
            result: "Thinking...",
          },
        ]
      : [...history]
  ).reverse();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <Container>
      <TitleContainer>
        <h1>Awesome Agent</h1>

        {isSuccess ? (
          <p>
            Welcome <strong>{data.data.user.sub}</strong>
          </p>
        ) : null}
      </TitleContainer>

      <Form onSubmit={handleSubmit}>
        <Prompt
          placeholder="Your prompt ... 🙂"
          rows={5}
          cols={80}
          onChange={handlePromptChange}
          value={prompt}
        />

        <button type="submit" disabled={!submitEnabled}>
          Send
        </button>
      </Form>

      {fullHistory.length ? (
        <HistoryContainer>
          <h2>Conversation</h2>
          <dl>
            {fullHistory.map((h) => {
              return [
                <dt key={h.timestamp.toISOString() + "_t"}>
                  <strong>You:</strong> {h.prompt}
                </dt>,
                <dd key={h.timestamp.toISOString() + "_d"}>
                  <strong>Agent ({h.timestamp.toLocaleTimeString()}):</strong>{" "}
                  {h.result}
                </dd>,
              ];
            })}
          </dl>
        </HistoryContainer>
      ) : null}
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const TitleContainer = styled.div`
  padding: 16px;
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
`;

const Prompt = styled.textarea`
  padding: 16px;
  border: 1px solid #ccc;
  border-radius: 16px;
`;

const HistoryContainer = styled.div`
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
`;

// Api call to fetch information on the current user
async function fetchUser(signal: AbortSignal) {
  const resp = await fetch("/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      call: "user",
    }),
    signal,
  });
  if (!resp.ok) throw new Error("Failed to fetch user");
  return resp.json() as Promise<{
    data: {
      user: {
        sub: string;
        traits: Record<string, string[]>;
      };
    };
  }>;
}

// Api call to submit a prompt
async function submitPrompt(variables: { prompt: string;}) {
  const resp = await fetch("/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      call: "prompt",
      params: variables,
    }),
  });
  if (!resp.ok) throw new Error("Failed to submit prompt");
  return resp.json() as Promise<{
    data: {
      result: string;
    };
  }>;
}
