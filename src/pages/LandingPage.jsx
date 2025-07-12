import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const [apiKey, setApiKey] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('openai_api_key', apiKey);
    navigate('/chat');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-400 to-purple-500 text-white p-4">
      <h1 className="text-4xl font-bold mb-6">Welcome to AI Chat</h1>
      <p className="text-xl mb-8 text-center">Experience the power of AI-driven conversations. To get started, please enter your OpenAI API key.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Input
          type="password"
          placeholder="Enter your OpenAI API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mb-4 text-black"
        />
        <Button type="submit" className="w-full bg-white text-blue-500 hover:bg-blue-100">
          Start Chatting
        </Button>
      </form>
    </div>
  );
};

export default LandingPage;