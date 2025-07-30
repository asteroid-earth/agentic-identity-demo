import styled from "styled-components";
import "./App.css";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

export function App() {
  const [prompt, setPrompt] = useState("");
  const [roles, setRoles] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<
    { prompt: string; roles: string[]; result: string; timestamp: Date }[]
  >([]);

  // Used to fetch user data including email/subject and assigned roles
  const { isLoading, isSuccess, data, error } = useQuery({
    queryKey: ["user"],
    queryFn: ({ signal }) => fetchUser(signal),
    staleTime: 0, // Don't cache this query
  });

  const { mutateAsync } = useMutation({
    mutationFn: (params: Parameters<typeof submitPrompt>[0]) =>
      submitPrompt(params),
    onSuccess: (data) => {
      setHistory((prevHistory) => [
        ...prevHistory,
        {
          prompt,
          result: data.data.result,
          roles: Object.entries(roles)
            .filter(([, checked]) => checked)
            .map(([role]) => role),
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
          roles: Object.entries(roles)
            .filter(([, checked]) => checked)
            .map(([role]) => role),
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
      roles: Object.entries(roles)
        .filter(([, checked]) => checked)
        .map(([role]) => role),
    });
  };

  // Toggle the selected state for the given role
  const handleRoleToggled = (role: string) => {
    setRoles((prevRoles) => ({
      ...prevRoles,
      [role]: !prevRoles[role],
    }));
  };

  // Whether the submit button is enabled
  const submitEnabled =
    !!prompt && Object.values(roles).some((checked) => checked);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <>
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

        <fieldset>
          <legend>Allow roles:</legend>

          {isSuccess
            ? data.data.user.roles.map((role) => (
                <div key={role}>
                  <input
                    type="checkbox"
                    id={role}
                    name={role}
                    checked={roles[role]}
                    onChange={() => handleRoleToggled(role)}
                  />
                  <label htmlFor={role}>{role}</label>
                </div>
              ))
            : null}
        </fieldset>

        <button type="submit" disabled={!submitEnabled}>
          Send
        </button>
      </Form>

      {history.length ? (
        <HistoryContainer>
          <h2>History:</h2>
          <dl>
            {history.map((h) => {
              return [
                <dt key={h.timestamp.toISOString() + "_t"}>
                  <strong>You:</strong> {h.prompt} ({h.roles.join(", ")})
                </dt>,
                <dd key={h.timestamp.toISOString() + "_d"}>
                  <strong>Agent:</strong> {h.result}
                </dd>,
              ];
            })}
          </dl>
        </HistoryContainer>
      ) : null}
    </>
  );
}

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
        roles: string[];
        sub: string;
        traits: Record<string, string[]>;
      };
    };
  }>;
}

// Api call to submit a prompt and the allowed roles
async function submitPrompt(variables: { prompt: string; roles: string[] }) {
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
