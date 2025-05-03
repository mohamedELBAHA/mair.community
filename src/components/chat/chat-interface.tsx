"use client";

import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
      api: "/api/chat",
    });

  const components: Components = {
    a: ({ ...props }) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
      />
    ),
    p: ({ ...props }) => <p {...props} className="mb-2" />,
    ul: ({ ...props }) => (
      <ul {...props} className="mb-2 list-inside list-disc" />
    ),
    ol: ({ ...props }) => (
      <ol {...props} className="mb-2 list-inside list-decimal" />
    ),
    li: ({ ...props }) => <li {...props} className="mb-1" />,
    code: ({ ...props }) => (
      <code {...props} className="rounded bg-gray-100 px-1 py-0.5" />
    ),
    pre: ({ ...props }) => (
      <pre
        {...props}
        className="my-2 overflow-x-auto rounded bg-gray-100 p-2"
      />
    ),
  };

  return (
    <div className="flex h-[600px] flex-col bg-gray-50">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div
              className={`max-w-[70%] rounded-2xl p-3 ${
                m.role === "user"
                  ? "rounded-tr-sm bg-blue-50 text-white"
                  : "prose prose-sm max-w-none rounded-tl-sm bg-white text-gray-800 shadow-sm"
              }`}
            >
              <ReactMarkdown components={components}>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="animate-fade-in flex justify-start">
            <div className="flex max-w-[80px] items-center gap-2 rounded-2xl rounded-tl-sm bg-gray-100 p-3 text-gray-800">
              <div className="flex gap-1">
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
            </div>
          </div>
        )}
        {error && <div className="text-red-500">Error: {error.message}</div>}
      </div>

      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question about our podcast episodes..."
            disabled={isLoading}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-50"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-full bg-blue-50 px-6 py-2 text-white hover:bg-blue-40 focus:outline-none focus:ring-2 focus:ring-blue-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
