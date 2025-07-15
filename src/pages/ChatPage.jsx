import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from 'react-markdown'
import SettingsModal from '@/components/SettingsModal';
import { Loader2, PlusCircle, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from "@/components/ui/use-toast"
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const ChatPage = () => {
  // Suggestion: Change 'openai_api_key' to 'gemini_api_key' for clarity
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [systemMessage, setSystemMessage] = useState(() => localStorage.getItem('system_message') || 'You are a helpful assistant.');
  const [conversations, setConversations] = useState(() => {
    const savedConversations = localStorage.getItem('conversations');
    return savedConversations ? JSON.parse(savedConversations) : [{ id: Date.now(), title: 'New Chat', messages: [] }];
  });
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollAreaRef = useRef(null);
  const navigate = useNavigate();

  const filteredConversations = conversations.filter(conversation =>
    conversation.title && conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!apiKey) {
      navigate('/');
    }
  }, [apiKey, navigate]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      // A small delay allows the DOM to update before scrolling
      setTimeout(() => {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }, 0);
    }
  }, [conversations, currentConversationIndex]);

  useEffect(() => {
    // Suggestion: Change 'openai_api_key' to 'gemini_api_key' for clarity
    localStorage.setItem('openai_api_key', apiKey);
    localStorage.setItem('system_message', systemMessage);
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [apiKey, systemMessage, conversations]);

  const generateTitle = async (messages) => {
    try {
      const concatenatedMessages = messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const geminiPrompt = [
        {
          role: 'user',
          parts: [{
            text: `Generate a short, concise title (3-5 words) for this conversation based on its main topic.\n\nConversation:\n${concatenatedMessages}`
          }]
        }
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ contents: geminiPrompt })
        }
      );

      if (!response.ok) return 'New Chat'; // Don't error out, just use default

      const data = await response.json();
      const title = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/"/g, '') || 'New Chat';
      return title;
    } catch (error) {
      console.error('Error generating title:', error);
      return 'New Chat';
    }
  };

  const startNewConversation = () => {
    const newConversation = { id: Date.now(), title: 'New Chat', messages: [] };
    setConversations(prev => [...prev, newConversation]);
    setCurrentConversationIndex(conversations.length);
  };

  const switchConversation = (index) => {
    setCurrentConversationIndex(index);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
  
    if (!apiKey) {
      toast({
        title: "API Key Missing",
        description: "Please set your Gemini API key in the settings.",
        variant: "destructive",
      });
      return;
    }
  
    const userMessage = { role: 'user', content: input };
    
    // Create a new array for the updated conversations to avoid direct state mutation
    const updatedConversations = JSON.parse(JSON.stringify(conversations));
    updatedConversations[currentConversationIndex].messages.push(userMessage);
    
    // Update the state to show the user's message immediately
    setConversations(updatedConversations);
    setInput('');
    setIsStreaming(true);
  
    // 1. Correctly format messages for the Gemini API
    const currentMessages = updatedConversations[currentConversationIndex].messages;
    const formattedContents = currentMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
  
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          // 2. Structure the body with `systemInstruction` and the formatted `contents`
          body: JSON.stringify({
            contents: formattedContents,
            systemInstruction: {
              parts: [{ text: systemMessage }]
            },
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              maxOutputTokens: 8192,
            }
          })
        }
      );
  
      if (!response.ok) {
          const errorData = await response.json();
          console.error("API Error:", errorData);
          throw new Error(errorData.error.message || `Request failed with status ${response.status}`);
      }
  
      const data = await response.json();
  
      // 3. Safely parse the response from Gemini
      const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
      if (!geminiText) {
          console.error("Invalid response structure:", data);
          if (data.promptFeedback?.blockReason) {
            throw new Error(`Request blocked for safety reasons: ${data.promptFeedback.blockReason}`);
          }
          throw new Error("Received an invalid or empty response from the API.");
      }
      
      const assistantMessage = { role: 'assistant', content: geminiText };
  
      setConversations((prevConversations) => {
        const newConversations = JSON.parse(JSON.stringify(prevConversations));
        newConversations[currentConversationIndex].messages.push(assistantMessage);
        return newConversations;
      });
  
      // Generate title after the first successful exchange
      if (currentMessages.length <= 2 && updatedConversations[currentConversationIndex].title === 'New Chat') {
        const newTitle = await generateTitle([userMessage, assistantMessage]);
        setConversations((prevConversations) => {
          const finalConversations = JSON.parse(JSON.stringify(prevConversations));
          finalConversations[currentConversationIndex].title = newTitle;
          return finalConversations;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { role: 'assistant', content: `**Error:** ${error.message}` };
      setConversations((prevConversations) => {
          const newConversations = JSON.parse(JSON.stringify(prevConversations));
          newConversations[currentConversationIndex].messages.push(errorMessage);
          return newConversations;
      });
    } finally {
      setIsStreaming(false);
    }
  };


  return (
    <div className="flex h-screen bg-chatbg">
       <div className={`relative transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
        <div className={`h-full bg-white border-r overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
          <div className="p-4">
            <Button onClick={startNewConversation} className="w-full mb-4">
              <PlusCircle className="mr-2 h-4 w-4" /> New Chat
            </Button>
            <div className="relative mb-4">
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <ScrollArea className="h-[calc(100vh-180px)]">
              {filteredConversations.map((conv, index) => {
                 const originalIndex = conversations.findIndex(c => c.id === conv.id);
                 return (
                    <Button
                      key={conv.id}
                      onClick={() => switchConversation(originalIndex)}
                      variant={currentConversationIndex === originalIndex ? "secondary" : "ghost"}
                      className="w-full justify-start mb-2 truncate"
                    >
                      {conv.title}
                    </Button>
                 );
              })}
            </ScrollArea>
          </div>
        </div>
      </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-4 bg-white hover:bg-gray-100 z-10 transition-all duration-300"
          style={{ left: isSidebarOpen ? '16rem' : '0.5rem' }} // 256px = 16rem
        >
          {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
        </Button>
      <div className="flex flex-col flex-grow overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
           <h2 className="text-lg font-semibold">{conversations[currentConversationIndex]?.title || 'Chat'}</h2>
           <SettingsModal
            apiKey={apiKey}
            setApiKey={setApiKey}
            systemMessage={systemMessage}
            setSystemMessage={setSystemMessage}
          />
        </div>
        <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
         {conversations[currentConversationIndex] && conversations[currentConversationIndex].messages.map((message, index) => (
            <div key={index} className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl lg:max-w-3xl p-3 rounded-lg shadow-md ${
                message.role === 'user' ? 'bg-usermsg text-white' : 'bg-white text-gray-800'
              }`}>
                <ReactMarkdown
                  className="prose max-w-none prose-p:my-2 prose-headings:my-3 dark:prose-invert"
                  components={{
                    code({node, inline, className, children, ...props}) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          {...props}
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code {...props} className={className}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
           {isStreaming && (
                <div className="mb-4 flex justify-start">
                     <div className="max-w-xl lg:max-w-3xl p-3 rounded-lg shadow-md bg-white text-gray-800">
                         <Loader2 className="h-5 w-5 animate-spin" />
                     </div>
                </div>
            )}
        </ScrollArea>
        <div className="p-4 bg-white border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message to Gemini..."
              className="flex-grow"
              disabled={isStreaming}
            />
            <Button type="submit" disabled={isStreaming} className="bg-usermsg hover:bg-blue-600">
              {isStreaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;