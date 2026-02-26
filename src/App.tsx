import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Code2, 
  BookOpen, 
  Terminal, 
  Play, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Lightbulb, 
  FileText, 
  Plus, 
  Search,
  Loader2,
  Trophy,
  Layout as LayoutIcon,
  Languages,
  Settings as SettingsIcon,
  ShieldCheck,
  Zap,
  Target,
  Users,
  Star,
  Quote,
  Github,
  Twitter,
  Linkedin
} from 'lucide-react';
import { Language, Question, TestSession } from './types';
import { 
  runCodeMock,
  getLearningContent,
  getExpertAdvice,
  generateSingleQuestion,
  translateSolution,
  fetchSingleQuestionByTitle
} from './geminiService';
import Split from 'react-split';
import Editor from '@monaco-editor/react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [view, setView] = useState<'home' | 'test' | 'import' | 'settings' | 'learning' | 'expert' | 'results'>('home');
  const [session, setSession] = useState<TestSession | null>(null);
  const [importText, setImportText] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [learningLang, setLearningLang] = useState('java');
  const [learningTopic, setLearningTopic] = useState('');
  const [learningContent, setLearningContent] = useState('');
  const [expertQuery, setExpertQuery] = useState('');
  const [expertResponse, setExpertResponse] = useState('');
  const [activeTab, setActiveTab] = useState<'description' | 'hints' | 'solution'>('description');
  const [translatedSolution, setTranslatedSolution] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
  const [loadingLearning, setLoadingLearning] = useState(false);
  const [loadingExpert, setLoadingExpert] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingMockTest, setLoadingMockTest] = useState(false);

  // Check for API Key
  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const localKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    const envKey = process.env.GEMINI_API_KEY;
    
    if ((!envKey || envKey === "MY_GEMINI_API_KEY") && !localKey) {
      setApiKeyMissing(true);
    } else {
      setApiKeyMissing(false);
    }
  };

  const handleSaveCustomKey = () => {
    if (customApiKey.trim()) {
      localStorage.setItem('CUSTOM_GEMINI_API_KEY', customApiKey.trim());
      setApiKeyMissing(false);
      setError(null);
      window.location.reload();
    } else {
      localStorage.removeItem('CUSTOM_GEMINI_API_KEY');
      checkApiKey();
    }
  };

  const handleOpenKeySelector = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        // After opening, we assume success as per guidelines
        setApiKeyMissing(false);
        setError(null);
        window.location.reload(); // Reload to pick up new key
      } catch (err) {
        console.error("Failed to open key selector", err);
        setError("Could not open API key selector.");
      }
    } else {
      setError("Platform key selector not available. Please use the Secrets panel.");
    }
  };

  // --- Handlers ---

  const handleStartMockTest = async (topic: string) => {
    if (apiKeyMissing) {
      setShowKeyModal(true);
      return;
    }
    setLoadingMockTest(true);
    setError(null);
    try {
      const total = 5;
      // Generate first question immediately
      const firstQuestion = await generateSingleQuestion(topic, 0, total);
      
      const newSession: TestSession = {
        id: Math.random().toString(36).substr(2, 9),
        questions: [firstQuestion],
        currentQuestionIndex: 0,
        userCodes: {
          [firstQuestion.id]: { ...firstQuestion.starterCode }
        },
        language: 'java'
      };
      
      setSession(newSession);
      setView('test');
      setLoadingMockTest(false);

      // Generate remaining questions in background
      for (let i = 1; i < total; i++) {
        try {
          const q = await generateSingleQuestion(topic, i, total);
          setSession(prev => {
            if (!prev) return null;
            return {
              ...prev,
              questions: [...prev.questions, q],
              userCodes: {
                ...prev.userCodes,
                [q.id]: { ...q.starterCode }
              }
            };
          });
        } catch (err) {
          console.error(`Failed to generate question ${i + 1}`, err);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate test. Please try again.");
      setLoadingMockTest(false);
    }
  };

  const handleImportQuestions = async () => {
    if (apiKeyMissing) {
      setShowKeyModal(true);
      return;
    }
    const titles = importText.split('\n').filter(t => t.trim() !== '');
    if (titles.length === 0) return;

    setLoadingImport(true);
    setError(null);
    try {
      const total = titles.length;
      // Fetch first question immediately
      const firstQuestion = await fetchSingleQuestionByTitle(titles[0], 0, total);
      
      const newSession: TestSession = {
        id: Math.random().toString(36).substr(2, 9),
        questions: [firstQuestion],
        currentQuestionIndex: 0,
        userCodes: {
          [firstQuestion.id]: { ...firstQuestion.starterCode }
        },
        language: 'java'
      };
      
      setSession(newSession);
      setView('test');
      setLoadingImport(false);

      // Fetch remaining questions in background
      for (let i = 1; i < total; i++) {
        try {
          const q = await fetchSingleQuestionByTitle(titles[i], i, total);
          setSession(prev => {
            if (!prev) return null;
            return {
              ...prev,
              questions: [...prev.questions, q],
              userCodes: {
                ...prev.userCodes,
                [q.id]: { ...q.starterCode }
              }
            };
          });
        } catch (err) {
          console.error(`Failed to fetch question ${i + 1}`, err);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to import questions. Please try again.");
      setLoadingImport(false);
    }
  };

  const changeLanguage = async (lang: Language) => {
    if (!session) return;
    setSession({ ...session, language: lang });
    setTranslatedSolution(null);
    if (activeTab === 'solution') {
      handleTranslateSolution(lang);
    }
  };

  const handleTranslateSolution = async (lang: string) => {
    if (!session) return;
    const currentQuestion = session.questions[session.currentQuestionIndex];
    setTranslating(true);
    try {
      const translation = await translateSolution(currentQuestion, lang);
      setTranslatedSolution(translation);
    } catch (err) {
      console.error(err);
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (view === 'test' && activeTab === 'solution' && !translatedSolution && session) {
      handleTranslateSolution(session.language);
    }
  }, [activeTab, view, session?.currentQuestionIndex]);

  const handleRunCode = async () => {
    if (apiKeyMissing) {
      setShowKeyModal(true);
      return;
    }
    if (!session) return;
    const currentQuestion = session.questions[session.currentQuestionIndex];
    const code = session.userCodes[currentQuestion.id][session.language];
    
    setRunning(true);
    setExecutionResult(null);
    try {
      const result = await runCodeMock(code, session.language, currentQuestion);
      setExecutionResult(result);
    } catch (error) {
      console.error(error);
      setExecutionResult({ status: "Error", message: "Failed to execute code." });
    } finally {
      setRunning(false);
    }
  };

  const updateCode = (newCode: string | undefined) => {
    if (!session || !newCode) return;
    const qId = session.questions[session.currentQuestionIndex].id;
    setSession({
      ...session,
      userCodes: {
        ...session.userCodes,
        [qId]: {
          ...session.userCodes[qId],
          [session.language]: newCode
        }
      }
    });
  };


  const nextQuestion = () => {
    if (!session || session.currentQuestionIndex >= session.questions.length - 1) return;
    setSession({ ...session, currentQuestionIndex: session.currentQuestionIndex + 1 });
    setExecutionResult(null);
    setActiveTab('description');
  };

  const prevQuestion = () => {
    if (!session || session.currentQuestionIndex <= 0) return;
    setSession({ ...session, currentQuestionIndex: session.currentQuestionIndex - 1 });
    setExecutionResult(null);
    setActiveTab('description');
  };

  const handleStartLearning = async () => {
    if (apiKeyMissing) {
      setShowKeyModal(true);
      return;
    }
    if (!learningTopic.trim()) return;
    setLoadingLearning(true);
    setError(null);
    setView('learning');
    try {
      const content = await getLearningContent(learningLang, learningTopic);
      setLearningContent(content);
    } catch (err: any) {
      setError(err.message || "Failed to load learning content.");
      setView('home');
    } finally {
      setLoadingLearning(false);
    }
  };

  const handleAskExpert = async () => {
    if (apiKeyMissing) {
      setShowKeyModal(true);
      return;
    }
    if (!expertQuery.trim()) return;
    setLoadingExpert(true);
    setError(null);
    setView('expert');
    try {
      const response = await getExpertAdvice(expertQuery);
      setExpertResponse(response);
    } catch (err: any) {
      setError(err.message || "Failed to get expert advice.");
      setView('home');
    } finally {
      setLoadingExpert(false);
    }
  };

  const MarkdownRenderer = ({ content }: { content: string }) => (
    <div className="markdown-body prose prose-invert max-w-none">
      <Markdown
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-8 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Code2 className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">DSA MASTER AI</h1>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium text-zinc-400 items-center">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-emerald-400 transition-colors">How it Works</a>
            <a href="#get-started" className="hover:text-emerald-400 transition-colors">Practice</a>
            <a href="#learning" className="hover:text-emerald-400 transition-colors">Learning</a>
            <a href="#developer" className="hover:text-emerald-400 transition-colors">Developer</a>
            <a href="#testimonials" className="hover:text-emerald-400 transition-colors">Stories</a>
            <div className="w-px h-4 bg-zinc-800" />
            <button 
              onClick={() => setView('settings')}
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
            >
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest border border-emerald-500/20 mb-6 inline-block">
              The Future of DSA Preparation
            </span>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent leading-[1.1]">
              Master Data Structures <br /> with AI Intelligence.
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              Generate personalized mock tests, import complex problems, and get detailed AI-powered solutions. Built for the next generation of software engineers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#get-started" className="px-8 py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2">
                Start Practicing Now <ChevronRight className="w-5 h-5" />
              </a>
              <button onClick={() => setView('settings')} className="px-8 py-4 bg-zinc-900 text-white font-bold rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-all">
                Configure API Key
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-8 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why DSA Master AI?</h2>
            <p className="text-zinc-400">Everything you need to ace your technical interviews.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-6 h-6 text-yellow-500" />,
                title: "Instant Generation",
                desc: "Get high-quality DSA questions tailored to your target topic in seconds."
              },
              {
                icon: <Target className="w-6 h-6 text-emerald-500" />,
                title: "Interview Focused",
                desc: "Questions curated from actual interview patterns of top tech giants like Google & Meta."
              },
              {
                icon: <Terminal className="w-6 h-6 text-blue-500" />,
                title: "Real-time Execution",
                desc: "Write, run, and debug your code in a professional LeetCode-style environment."
              },
              {
                icon: <Lightbulb className="w-6 h-6 text-purple-500" />,
                title: "AI Hints",
                desc: "Stuck? Get intelligent, progressive hints that guide you without spoiling the answer."
              },
              {
                icon: <FileText className="w-6 h-6 text-orange-500" />,
                title: "Detailed Solutions",
                desc: "Three distinct approaches for every problem, from brute force to most optimal."
              },
              {
                icon: <Users className="w-6 h-6 text-pink-500" />,
                title: "Import Anything",
                desc: "Paste any question title and our AI will reconstruct the full problem context."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="flex-1">
              <h2 className="text-4xl font-bold mb-8">How it Works</h2>
              <div className="space-y-8">
                {[
                  { step: "01", title: "Select your Topic", desc: "Choose from Array, String, DP, Graphs, or any other DSA topic." },
                  { step: "02", title: "AI Generates Test", desc: "Our AI crafts a set of questions with varying difficulties and edge cases." },
                  { step: "03", title: "Solve & Submit", desc: "Write code in your preferred language and run it against test cases." },
                  { step: "04", title: "Learn & Optimize", desc: "Review official solutions and optimize your approach for the next round." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <span className="text-emerald-500 font-mono font-bold text-xl">{item.step}</span>
                    <div>
                      <h4 className="text-lg font-bold mb-1">{item.title}</h4>
                      <p className="text-zinc-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="aspect-square bg-emerald-500/20 rounded-full blur-[100px] absolute inset-0" />
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-zinc-800 rounded w-1/2 animate-pulse" />
                  <div className="h-4 bg-zinc-800 rounded w-5/6 animate-pulse" />
                  <div className="h-32 bg-zinc-800/50 rounded w-full animate-pulse mt-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started / Dashboard Section */}
      <section id="get-started" className="py-24 px-8 bg-zinc-900/50 border-y border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Ready to Level Up?</h2>
            <p className="text-zinc-400">Choose your path and start mastering DSA today.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <motion.div 
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between h-[400px] shadow-xl"
            >
              <div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Terminal className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Generate Mock Test</h2>
                <p className="text-zinc-400 leading-relaxed mb-6">
                  Create a personalized interview simulation. Choose a topic or enter your own custom topic below.
                </p>
                <div className="relative mb-6">
                  <input 
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Enter custom topic (e.g. Backtracking)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                  />
                  <button 
                    onClick={() => handleStartMockTest(customTopic)}
                    disabled={!customTopic.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {['Array', 'String', 'Linked List', 'Trees', 'DP', 'Graphs'].map(topic => (
                  <button 
                    key={topic}
                    onClick={() => handleStartMockTest(topic)}
                    className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-emerald-500 hover:text-black transition-all text-sm font-medium border border-zinc-700"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between h-[400px] shadow-xl"
            >
              <div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Plus className="w-6 h-6 text-blue-500" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Import Questions</h2>
                <p className="text-zinc-400 leading-relaxed">
                  Paste a list of question titles from LeetCode, GFG, or elsewhere. Our AI will reconstruct the full context for your practice session.
                </p>
              </div>
              <div className="mt-8">
                <button 
                  onClick={() => setView('import')}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 transition-colors font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  Start Importing <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>

          <section>
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Recent Activity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Two Sum", lang: "JS", time: "2 hours ago" },
                { title: "Binary Tree Level Order", lang: "PY", time: "5 hours ago" },
                { title: "Longest Substring", lang: "CPP", time: "1 day ago" }
              ].map((item, i) => (
                <div key={i} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-700">
                    {item.lang}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{item.time}</p>
                  </div>
                  <div className="ml-auto text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      {/* Learning Section */}
      <section id="learning" className="py-24 px-8 bg-zinc-900/40">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Dedicated Language Learning</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Master any programming language with AI-guided modules. From basic syntax to advanced concepts, we've got you covered.
              </p>
              <div className="space-y-4 p-8 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Language</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {['java', 'python', 'javascript', 'cpp', 'sql'].map(lang => (
                        <button 
                          key={lang}
                          onClick={() => setLearningLang(lang)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase",
                            learningLang.toLowerCase() === lang ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                    <input 
                      type="text"
                      value={learningLang}
                      onChange={(e) => setLearningLang(e.target.value)}
                      placeholder="Or enter custom language (e.g. Rust, Go, SQL)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">What do you want to study?</label>
                  <input 
                    type="text"
                    value={learningTopic}
                    onChange={(e) => setLearningTopic(e.target.value)}
                    placeholder="e.g. Multithreading, Decorators, Closures"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <button 
                  onClick={handleStartLearning}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  Start Learning Module <BookOpen className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-4xl font-bold mb-6">Expert Interview Prep</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Discuss strategies, mock interview tips, and complex problems with our AI Interview Expert.
              </p>
              <div className="p-8 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl">
                <div className="mb-6">
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Ask the Expert</label>
                  <textarea 
                    value={expertQuery}
                    onChange={(e) => setExpertQuery(e.target.value)}
                    placeholder="How should I explain my thought process for DP problems?"
                    className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
                <button 
                  onClick={handleAskExpert}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                >
                  Get Expert Advice <Users className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section id="developer" className="py-24 px-8 bg-zinc-900/20">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-16 items-center">
            <div className="flex-1 order-2 md:order-1">
              <span className="text-emerald-500 font-bold text-sm uppercase tracking-widest mb-4 block">The Creator</span>
              <h2 className="text-4xl font-bold mb-6">Meet the Developers</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed text-lg">
                Hi, We're<strong> Md Jehid Alam, Md Farhan Ashraf, Md Waqar and Irfan Ashraf</strong>. We built DSA Master AI to bridge the gap between theoretical knowledge and practical interview success. 
                Our goal is to provide students with a high-quality, AI-driven platform that makes mastering data structures accessible and engaging.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Github className="w-5 h-5 text-zinc-400" />
                  </div>
                  <span className="text-zinc-300 font-medium">github.com/mdjehidalam</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Linkedin className="w-5 h-5 text-zinc-400" />
                  </div>
                  <span className="text-zinc-300 font-medium">linkedin.com/in/mdjehidalamindia</span>
                </div>
              </div>
            </div>
             <div className="flex-1 order-1 md:order-2">
              <div className="relative group">
                <div className="absolute -inset-4 bg-emerald-500/20 rounded-[3rem] blur-2xl group-hover:bg-emerald-500/30 transition-all" />
                <div className="relative aspect-square rounded-[2.5rem] overflow-hidden border-2 border-emerald-500/20 shadow-2xl">
                  <img 
                    src="https://pixabay.com/illustrations/artificial-intelligence-9908402/" 
                    alt="Md Jehid Alam" 
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </div>
          </div> 
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Success Stories</h2>
            <p className="text-zinc-400">Join thousands of students who aced their interviews.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Rahul Sharma",
                role: "SDE at Google",
                content: "DSA Master AI helped me simulate real interview pressure. The AI-generated hints were exactly what I needed to nudge my thinking without giving away the solution.",
                avatar: "RS"
              },
              {
                name: "Priya Patel",
                role: "Software Engineer at Meta",
                content: "The ability to import any question title and get a full LeetCode-style environment is a game changer. It saved me so much time during my prep.",
                avatar: "PP"
              },
              {
                name: "Ankit Verma",
                role: "Full Stack Developer",
                content: "As a college student, this project is incredible. The UI is clean, and the AI solutions are much more detailed than what I find on most platforms.",
                avatar: "AV"
              }
            ].map((story, i) => (
              <div key={i} className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 relative">
                <Quote className="absolute top-6 right-8 w-10 h-10 text-zinc-800" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-black">
                    {story.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold">{story.name}</h4>
                    <p className="text-xs text-emerald-500 font-medium">{story.role}</p>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed italic">"{story.content}"</p>
                <div className="flex gap-1 mt-6">
                  {[1, 2, 3, 4, 5].map(star => <Star key={star} className="w-3 h-3 fill-yellow-500 text-yellow-500" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-8 border-t border-zinc-800 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500 rounded-lg">
                  <Code2 className="w-6 h-6 text-black" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">DSA MASTER AI</h1>
              </div>
              <p className="text-zinc-500 max-w-sm leading-relaxed">
                Empowering the next generation of developers with AI-driven technical interview preparation. Master DSA, ace your interviews, and build your future.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-zinc-500">
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">How it Works</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6">Connect</h4>
              <div className="flex gap-4">
                <a href="#" className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"><Github className="w-5 h-5" /></a>
                <a href="#" className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"><Twitter className="w-5 h-5" /></a>
                <a href="#" className="p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"><Linkedin className="w-5 h-5" /></a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
            <p>© 2026 DSA Master AI. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-zinc-400 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-zinc-400 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );

  const renderImport = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <button onClick={() => setView('home')} className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white">
          <ChevronLeft className="w-5 h-5" /> Back to Home
        </button>
        <h2 className="text-4xl font-bold mb-4">Import Questions</h2>
        <p className="text-zinc-400 mb-8">Paste question titles, one per line. We'll find the details for you.</p>
        <textarea 
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="e.g.&#10;Two Sum&#10;Longest Palindromic Substring&#10;Reverse Linked List"
          className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
        />
        <button 
          onClick={handleImportQuestions}
          disabled={!importText.trim() || loadingImport}
          className="w-full mt-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold flex items-center justify-center gap-2"
        >
          {loadingImport ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Process Questions'}
        </button>
      </div>
    </div>
  );

  const renderLearning = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setView('home')} className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white">
          <ChevronLeft className="w-5 h-5" /> Back to Dashboard
        </button>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-4xl font-bold flex items-center gap-4">
            <BookOpen className="w-10 h-10 text-emerald-500" /> 
            Learning: <span className="text-emerald-500 uppercase">{learningLang}</span>
          </h2>
          <div className="px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest border border-emerald-500/20">
            {learningTopic}
          </div>
        </div>
        <div className="p-10 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl min-h-[400px] flex flex-col">
          {loadingLearning ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-zinc-500">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                <BookOpen className="w-8 h-8 text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Crafting your module...</h3>
                <p className="text-sm">Our AI is gathering deep insights on {learningTopic}.</p>
              </div>
            </div>
          ) : (
            <MarkdownRenderer content={learningContent} />
          )}
        </div>
      </div>
    </div>
  );

  const renderExpert = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setView('home')} className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white">
          <ChevronLeft className="w-5 h-5" /> Back to Dashboard
        </button>
        <h2 className="text-4xl font-bold mb-8 flex items-center gap-4">
          <Users className="w-10 h-10 text-blue-500" /> Expert Advice
        </h2>
        <div className="p-10 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl min-h-[400px] flex flex-col">
          <div className="mb-8 p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <p className="text-xs font-bold text-blue-500 uppercase mb-2">Your Query</p>
            <p className="text-lg italic">"{expertQuery}"</p>
          </div>
          
          {loadingExpert ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-zinc-500">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                <Users className="w-8 h-8 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Consulting with the Expert...</h3>
                <p className="text-sm">Analyzing your query for the best strategic advice.</p>
              </div>
            </div>
          ) : (
            <MarkdownRenderer content={expertResponse} />
          )}
        </div>
        <div className="mt-12 p-8 rounded-3xl bg-zinc-900 border border-zinc-800">
          <h3 className="text-xl font-bold mb-4">Follow-up Question?</h3>
          <div className="flex gap-4">
            <input 
              type="text"
              value={expertQuery}
              onChange={(e) => setExpertQuery(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Ask something else..."
            />
            <button 
              onClick={handleAskExpert}
              className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all"
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-4xl font-bold flex items-center gap-4">
            <Trophy className="w-10 h-10 text-yellow-500" /> Interview Summary
          </h2>
          <button onClick={() => setView('home')} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all">
            Back to Dashboard
          </button>
        </div>

        <div className="space-y-12">
          {session?.questions.map((q, idx) => (
            <div key={idx} className="p-8 rounded-[2.5rem] bg-zinc-900 border border-zinc-800 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <span className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold border border-emerald-500/20">
                  {idx + 1}
                </span>
                <h3 className="text-2xl font-bold">{q.title}</h3>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase ml-auto",
                  q.difficulty === 'Easy' ? "bg-emerald-500/10 text-emerald-500" :
                  q.difficulty === 'Medium' ? "bg-yellow-500/10 text-yellow-500" :
                  "bg-red-500/10 text-red-500"
                )}>
                  {q.difficulty}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-sm font-bold text-zinc-500 uppercase mb-4">Problem Description</h4>
                  <div className="p-6 bg-black/20 rounded-2xl border border-zinc-800/50">
                    <MarkdownRenderer content={q.description} />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-500 uppercase mb-4">Optimal Solution</h4>
                  <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-xl">
                    <MarkdownRenderer content={`\`\`\`${session.language}\n${q.solution.approaches[q.solution.approaches.length - 1].code}\n\`\`\``} />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-500 uppercase mb-6">Detailed Approaches</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {q.solution.approaches.map((app, i) => (
                    <div key={i} className="p-6 bg-zinc-800/30 rounded-2xl border border-zinc-700/50">
                      <h5 className="font-bold text-emerald-400 mb-2">{app.name}</h5>
                      <p className="text-xs text-zinc-400 line-clamp-3 mb-4">{app.description}</p>
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>T: {app.complexity.time}</span>
                        <span>S: {app.complexity.space}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCoding = () => {
    if (!session) return null;
    const currentQuestion = session.questions[session.currentQuestionIndex];
    const userCode = session.userCodes[currentQuestion.id][session.language];

    return (
      <div className="h-screen bg-[#0f0f0f] text-zinc-300 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('home')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <LayoutIcon className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="text-zinc-500">Question {session.currentQuestionIndex + 1} of {session.questions.length}</span>
              <span className="font-bold text-white">{currentQuestion.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={session.language}
              onChange={(e) => changeLanguage(e.target.value as Language)}
              className="bg-zinc-800 border-none rounded-md px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
            <button 
              onClick={handleRunCode}
              disabled={running}
              className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-bold transition-colors"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Run
            </button>
            <button 
              onClick={() => setView('results')}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black rounded-md text-xs font-bold transition-colors"
            >
              End Interview
            </button>
          </div>

          <div className="flex items-center gap-2">
             {session.questions.length < 5 && (
               <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800/50 rounded-full border border-zinc-700/50 mr-2">
                 <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                 <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Generating next...</span>
               </div>
             )}
             <button 
              onClick={prevQuestion}
              disabled={session.currentQuestionIndex === 0}
              className="p-2 hover:bg-zinc-800 rounded-lg disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={nextQuestion}
              disabled={session.currentQuestionIndex === session.questions.length - 1}
              className="p-2 hover:bg-zinc-800 rounded-lg disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <Split 
          className="flex flex-1 overflow-hidden"
          sizes={[40, 60]}
          minSize={300}
          gutterSize={4}
          gutterStyle={() => ({ backgroundColor: '#1f1f1f' })}
        >
          {/* Left Panel: Description */}
          <div className="flex flex-col bg-[#1a1a1a] overflow-hidden">
            <div className="flex border-b border-zinc-800 shrink-0">
              {['description', 'hints', 'solution'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={cn(
                    "px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
                    activeTab === tab 
                      ? "text-white border-emerald-500 bg-zinc-800/50" 
                      : "text-zinc-500 border-transparent hover:text-zinc-300"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 prose prose-invert prose-sm max-w-none">
              {activeTab === 'description' && (
                <div className="animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                      currentQuestion.difficulty === 'Easy' ? "bg-emerald-500/10 text-emerald-500" :
                      currentQuestion.difficulty === 'Medium' ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    )}>
                      {currentQuestion.difficulty}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase bg-zinc-800 px-2 py-0.5 rounded">
                      {currentQuestion.topic}
                    </span>
                  </div>
                  <MarkdownRenderer content={currentQuestion.description} />
                  
                  <h4 className="text-white mt-8 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Examples
                  </h4>
                  {currentQuestion.examples.map((ex, i) => (
                    <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-4">
                      <p className="font-mono text-xs mb-2"><span className="text-zinc-500">Input:</span> {ex.input}</p>
                      <p className="font-mono text-xs mb-2"><span className="text-zinc-500">Output:</span> {ex.output}</p>
                      {ex.explanation && <p className="text-xs text-zinc-400 italic">Explanation: {ex.explanation}</p>}
                    </div>
                  ))}

                  <h4 className="text-white mt-8 mb-4">Constraints</h4>
                  <ul className="list-disc pl-4 space-y-2">
                    {currentQuestion.constraints.map((c, i) => (
                      <li key={i} className="text-xs text-zinc-400">{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'hints' && (
                <div className="animate-in slide-in-from-left-2 duration-300">
                  <h3 className="text-white mb-6 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" /> Hints
                  </h3>
                  {currentQuestion.hints.map((hint, i) => (
                    <div key={i} className="mb-6 p-4 bg-zinc-900/50 border-l-4 border-yellow-500/50 rounded-r-xl">
                      <p className="text-sm leading-relaxed">{hint}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'solution' && (
                <div className="p-6 space-y-8 overflow-y-auto h-full custom-scrollbar">
                  {translating ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      <p className="text-sm font-medium">Translating solution to {session.language}...</p>
                    </div>
                  ) : translatedSolution ? (
                    <div className="animate-in fade-in duration-500">
                      <MarkdownRenderer content={translatedSolution} />
                    </div>
                  ) : (
                    currentQuestion.solution.approaches.map((app, i) => (
                      <div key={i} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white">{app.name}</h4>
                          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                            <span className="text-zinc-500">Time: <span className="text-emerald-500">{app.complexity.time}</span></span>
                            <span className="text-zinc-500">Space: <span className="text-emerald-500">{app.complexity.space}</span></span>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed">{app.description}</p>
                        <div className="rounded-xl overflow-hidden border border-zinc-800">
                          <MarkdownRenderer content={`\`\`\`${session.language}\n${app.code}\n\`\`\``} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Editor & Console */}
          <Split 
            direction="vertical"
            sizes={[70, 30]}
            minSize={100}
            gutterSize={4}
            gutterStyle={() => ({ backgroundColor: '#1f1f1f' })}
            className="flex flex-col overflow-hidden"
          >
            <div className="bg-[#1e1e1e] relative">
              <Editor
                height="100%"
                language={session.language === 'cpp' ? 'cpp' : session.language}
                theme="vs-dark"
                value={userCode}
                onChange={updateCode}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  padding: { top: 20 },
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>

            <div className="bg-[#0f0f0f] flex flex-col overflow-hidden border-t border-zinc-800">
              <div className="h-10 border-b border-zinc-800 flex items-center px-4 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Console</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                {!executionResult && !running && (
                  <p className="text-zinc-600 italic">Run your code to see results here...</p>
                )}
                {running && (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing test cases...</span>
                  </div>
                )}
                {executionResult && (
                  <div className="animate-in fade-in duration-300">
                    <div className={cn(
                      "mb-4 font-bold text-sm",
                      executionResult.status === 'Accepted' ? "text-emerald-500" : "text-red-500"
                    )}>
                      {executionResult.status}
                    </div>
                    {executionResult.results?.map((res: any, i: number) => (
                      <div key={i} className="mb-4 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-zinc-500">Case {res.exampleIndex + 1}</span>
                          <span className={res.passed ? "text-emerald-500" : "text-red-500"}>
                            {res.passed ? "Passed" : "Failed"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase mb-1">Expected</p>
                            <pre className="bg-black/30 p-2 rounded">{res.expectedOutput}</pre>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 uppercase mb-1">Actual</p>
                            <pre className={cn("p-2 rounded", res.passed ? "bg-emerald-500/5 text-emerald-400" : "bg-red-500/5 text-red-400")}>
                              {res.actualOutput}
                            </pre>
                          </div>
                        </div>
                        {res.consoleLog && (
                          <div className="mt-2 pt-2 border-t border-zinc-800">
                            <p className="text-[10px] text-zinc-600 uppercase mb-1">Stdout</p>
                            <pre className="text-zinc-400 italic">{res.consoleLog}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Split>
        </Split>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setView('home')} className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white">
          <ChevronLeft className="w-5 h-5" /> Back to Dashboard
        </button>
        
        <h2 className="text-4xl font-bold mb-8 flex items-center gap-4">
          <SettingsIcon className="w-10 h-10 text-emerald-500" /> Application Settings
        </h2>

        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Gemini API Configuration</h3>
                  <p className="text-zinc-400 text-sm">Manage your AI model credentials</p>
                </div>
              </div>
              <div className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                apiKeyMissing ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
              )}>
                {apiKeyMissing ? "Key Missing" : "Key Configured"}
              </div>
            </div>

            <p className="text-zinc-400 mb-8 leading-relaxed">
              The application uses the Gemini API to generate DSA questions, hints, and solutions. 
              You can configure your API key using the platform's secure selector or enter it manually below.
            </p>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-zinc-300 mb-3">Option 1: Platform Selector (Recommended)</h4>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={handleOpenKeySelector}
                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Use Platform Selector
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-300 mb-3">Option 2: Manual Key Entry</h4>
                <div className="flex flex-col sm:flex-row gap-4">
                  <input 
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Enter your Gemini API Key"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-emerald-500 transition-colors font-mono text-sm"
                  />
                  <button 
                    onClick={handleSaveCustomKey}
                    className="px-8 py-4 bg-zinc-100 hover:bg-white text-black font-bold rounded-2xl transition-all"
                  >
                    Save Key
                  </button>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Your key is stored locally in your browser and is never sent to our servers.
                </p>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <button 
                onClick={() => window.location.reload()}
                className="text-emerald-500 hover:text-emerald-400 text-sm font-bold flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4" /> Reload Application to Apply Changes
              </button>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Developer Information</h3>
                <p className="text-zinc-400 text-sm">Project created by Md Jehid Alam</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700">
                <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Developer Name</p>
                <p className="font-medium">Md Jehid Alam</p>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700">
                <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Contact Email</p>
                <p className="font-medium">mdjehidalam@gmail.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans selection:bg-emerald-500/30">
      <AnimatePresence>
        {showKeyModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] max-w-lg shadow-2xl relative"
            >
              <button 
                onClick={() => setShowKeyModal(false)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>

              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-8 mx-auto">
                <ShieldCheck className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-bold mb-4">AI Features Locked</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                To generate questions, provide hints, and run code simulations, you need to configure your Gemini API Key. 
                It's quick and secure.
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={handleOpenKeySelector}
                  className="px-8 py-4 bg-emerald-600 text-black font-bold rounded-2xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  <Plus className="w-5 h-5" /> Configure Key Now
                </button>
                <button 
                  onClick={() => setShowKeyModal(false)}
                  className="px-8 py-4 bg-zinc-800 text-white font-bold rounded-2xl hover:bg-zinc-700 transition-all"
                >
                  Maybe Later
                </button>
              </div>
              <p className="mt-6 text-xs text-zinc-600">
                Your key is stored locally in your browser for this session.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3"
          >
            <div className="bg-white/20 p-1 rounded-full">
              <Plus className="w-4 h-4 rotate-45" />
            </div>
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:opacity-70">
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {loadingMockTest && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Preparing your session...</h3>
                <p className="text-zinc-500 text-sm">Our AI is crafting high-quality interview questions.</p>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-4 text-emerald-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-bold uppercase tracking-widest">Initializing Environment...</span>
            </div>
          </div>
        </div>
      )}

      {view === 'home' && renderHome()}
      {view === 'import' && renderImport()}
      {view === 'test' && renderCoding()}
      {view === 'settings' && renderSettings()}
      {view === 'learning' && renderLearning()}
      {view === 'expert' && renderExpert()}
      {view === 'results' && renderResults()}
    </div>
  );
}
