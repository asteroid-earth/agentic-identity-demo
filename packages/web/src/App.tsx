import styled from "styled-components";
import "./App.css";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

export function App() {
  const [prompt, setPrompt] = useState("");
  const [roles, setRoles] = useState<Record<string, boolean>>({});

  // Used to fetch user data including email/subject and assigned roles
  const { isLoading, isSuccess, data, error } = useQuery({
    queryKey: ["user"],
    queryFn: ({ signal }) => fetchUser(signal),
    staleTime: 0, // Don't cache this query
  });

  const {
    mutateAsync,
    data: promptData,
    error: promptError,
  } = useMutation({
    mutationFn: (params: Parameters<typeof submitPrompt>[0]) =>
      submitPrompt(params),
    onSuccess: (data) => {
      console.log("Prompt success", data);
      setPrompt("");
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
      <h1>Awesome Agent</h1>

      {isSuccess ? (
        <p>
          Welcome <strong>{data.data.user.sub}</strong>
        </p>
      ) : null}

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

      {promptData ? <p>{promptData.data.result}</p> : null}

      {promptError ? <p>Error: {promptError.message}</p> : null}
    </>
  );
}

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
