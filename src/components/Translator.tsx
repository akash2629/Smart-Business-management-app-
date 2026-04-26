import React, { useState } from 'react';
import { Languages, ArrowRightLeft, Copy, Check, Sparkles, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';

export default function Translator() {
  const { language, t } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetLang, setTargetLang] = useState<'bn' | 'en'>(language === 'bn' ? 'en' : 'bn');
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, targetLang }),
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setOutputText(data.translatedText);
      toast.success('Translation complete');
    } catch (error: any) {
      toast.error(error.message || 'Translation failed');
    } finally {
      setLoading(false);
    }
  };

  const swapLanguages = () => {
    setTargetLang(targetLang === 'bn' ? 'en' : 'bn');
    setInputText(outputText);
    setOutputText(inputText);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6 sm:space-y-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-brand-primary uppercase tracking-[0.3em]">
            <div className="w-4 h-[2px] bg-brand-primary/30"></div>
            Intelligence
          </div>
          <h1 className="text-4xl sm:text-6xl font-serif font-black tracking-tighter leading-none flex items-center gap-4">
            Smart Translator
            <Sparkles className="text-brand-accent animate-pulse" size={40} />
          </h1>
          <p className="text-slate-500 font-medium tracking-tight text-base sm:text-lg">
            Professional Bangla-English translation powered by AI.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Languages size={14} />
              {targetLang === 'bn' ? 'Source: English' : 'Source: Bangla'}
            </span>
          </div>
          <div className="premium-card p-1 min-h-[300px] flex flex-col">
            <textarea
              className="flex-1 p-6 bg-transparent resize-none focus:outline-none font-bold text-lg text-slate-800 placeholder:text-slate-300"
              placeholder="Paste text here to translate..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="p-4 border-t border-slate-50 flex justify-end">
              <button
                onClick={handleTranslate}
                disabled={loading || !inputText.trim()}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white font-black text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-xl active:scale-95"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Wand2 size={18} />
                )}
                Translate
              </button>
            </div>
          </div>
        </div>

        {/* Swap button for desktop */}
        <div className="hidden lg:flex items-center justify-center -mx-4 z-10 absolute left-1/2 top-[400px] pointer-events-none">
          <button 
            onClick={swapLanguages}
            className="w-12 h-12 rounded-full bg-white shadow-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all pointer-events-auto active:scale-90"
          >
            <ArrowRightLeft size={20} />
          </button>
        </div>

        {/* Output area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Languages size={14} />
              {targetLang === 'bn' ? 'Target: Bangla' : 'Target: English'}
            </span>
          </div>
          <div className="premium-card p-1 min-h-[300px] flex flex-col bg-slate-50/30">
            <div className="flex-1 p-6 font-bold text-lg text-slate-800 whitespace-pre-wrap">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
                </div>
              ) : outputText ? (
                outputText
              ) : (
                <span className="text-slate-300 italic font-medium tracking-tight">Translation will appear here...</span>
              )}
            </div>
            <div className="p-4 border-t border-slate-50 flex justify-end">
              <button
                disabled={!outputText}
                onClick={copyToClipboard}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
              >
                {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile swap button */}
      <div className="lg:hidden flex justify-center">
        <button 
          onClick={swapLanguages}
          className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white border border-slate-100 text-slate-900 font-bold text-sm shadow-sm active:scale-95"
        >
          <ArrowRightLeft size={16} />
          Swap Languages
        </button>
      </div>

      <div className="p-10 rounded-[3rem] bg-brand-primary/5 border border-brand-primary/10">
        <h4 className="text-xl font-serif font-black mb-4">Why use Smart Translator?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <div className="text-brand-primary font-black uppercase text-[10px] tracking-widest">Accuracy</div>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">Advanced AI models capture the exact meaning and tone of your business communication.</p>
          </div>
          <div className="space-y-2">
            <div className="text-brand-primary font-black uppercase text-[10px] tracking-widest">Natural Flow</div>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">We don't do robotic word-for-word translations. We provide natural, fluent Bangla and English.</p>
          </div>
          <div className="space-y-2">
            <div className="text-brand-primary font-black uppercase text-[10px] tracking-widest">Business Context</div>
            <p className="text-slate-600 text-sm font-medium leading-relaxed">Specially tuned for shop management, inventory, and financial terminology.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
