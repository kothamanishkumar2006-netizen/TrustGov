/**
 * TRUSTGOV - PHASE 10: IVR ACCESSIBILITY & TELEPHONY SIMULATOR
 * 
 * Developer / Admin console for interactive simulation of the TrustGov voice gateway.
 * Allows DTMF dialing, alphanumeric officer code input, audio prompt readout,
 * and deterministic testing of Phase 7, 8, and 9 integrations.
 */

import React, { useState } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  Volume2,
  VolumeX,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Lock,
  PlayCircle
} from 'lucide-react';

interface IvrSessionData {
  sessionId: string;
  state: string;
  status: string;
  prompt: string;
  options?: string[];
  verificationResult?: string;
  verificationReference?: string | null;
  authorizationResult?: string;
  riskLevel?: string;
  authorizationReference?: string | null;
  reportReference?: string | null;
  attemptCount?: number;
  maxAttempts?: number;
  expiresAt?: string;
}

const IvrSimulator: React.FC = () => {
  const [session, setSession] = useState<IvrSessionData | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [callHistory, setCallHistory] = useState<Array<{ sender: 'SYSTEM' | 'CALLER'; text: string; time: string }>>([]);

  const speakPrompt = (text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const handleStartCall = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ivr/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerId: '+91 98765 00000', language: 'en-IN' })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        setInputValue('');
        setCallHistory([
          { sender: 'SYSTEM', text: data.data.prompt, time: new Date().toLocaleTimeString() }
        ]);
        speakPrompt(data.data.prompt);
      } else {
        setErrorMsg(data.error?.message || 'Failed to start call');
      }
    } catch (err: any) {
      setErrorMsg('Network error starting IVR call');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInput = async (forcedValue?: string) => {
    const valToSend = forcedValue !== undefined ? forcedValue : inputValue;
    if (!session || !valToSend.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const timeStr = new Date().toLocaleTimeString();
    setCallHistory(prev => [...prev, { sender: 'CALLER', text: valToSend.trim(), time: timeStr }]);

    try {
      const res = await fetch(`/api/ivr/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputType: 'DTMF', value: valToSend.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        setInputValue('');
        setCallHistory(prev => [
          ...prev,
          { sender: 'SYSTEM', text: data.data.prompt, time: new Date().toLocaleTimeString() }
        ]);
        speakPrompt(data.data.prompt);
      } else {
        setErrorMsg(data.error?.message || 'Input rejected');
      }
    } catch (err: any) {
      setErrorMsg('Network error processing keypad input');
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (key: string) => {
    setInputValue(prev => prev + key);
  };

  const handleRepeat = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ivr/session/${session.sessionId}/repeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        speakPrompt(data.data.prompt);
        setCallHistory(prev => [
          ...prev,
          { sender: 'SYSTEM', text: `[Repeated]: ${data.data.prompt}`, time: new Date().toLocaleTimeString() }
        ]);
      }
    } catch {
      setErrorMsg('Failed to repeat prompt');
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ivr/session/${session.sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        speakPrompt(data.data.prompt);
        setCallHistory(prev => [
          ...prev,
          { sender: 'SYSTEM', text: `[Call Ended]: ${data.data.prompt}`, time: new Date().toLocaleTimeString() }
        ]);
      }
    } catch {
      setErrorMsg('Failed to end call');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSimulator = async () => {
    setLoading(true);
    try {
      await fetch('/api/ivr/simulator/reset', { method: 'POST' });
      setSession(null);
      setInputValue('');
      setCallHistory([]);
      setErrorMsg(null);
    } catch {
      setErrorMsg('Failed to reset simulator');
    } finally {
      setLoading(false);
    }
  };

  // Pre-configured Quick Demo Handlers
  const runDemoScenario = async (type: 'VERIFY' | 'PAYMENT' | 'FAILED_OFFICER' | 'REPORT' | 'LOCKOUT') => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Start fresh call
      const startRes = await fetch('/api/ivr/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerId: '+91 99999 88888' })
      });
      const startData = await startRes.json();
      if (!startData.success) throw new Error('Start call failed');
      const sid = startData.data.sessionId;

      const history: Array<{ sender: 'SYSTEM' | 'CALLER'; text: string; time: string }> = [
        { sender: 'SYSTEM', text: startData.data.prompt, time: new Date().toLocaleTimeString() }
      ];

      const postInput = async (val: string) => {
        history.push({ sender: 'CALLER', text: val, time: new Date().toLocaleTimeString() });
        const r = await fetch(`/api/ivr/session/${sid}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputType: 'DTMF', value: val })
        });
        const d = await r.json();
        if (d.success) {
          history.push({ sender: 'SYSTEM', text: d.data.prompt, time: new Date().toLocaleTimeString() });
          return d.data;
        }
        throw new Error(d.error?.message || 'Input failed');
      };

      let currentData = startData.data;

      if (type === 'VERIFY') {
        // Press 1 to verify -> enter TG-OFF-001 -> Press 2 -> enter 4 (REQUEST_DOCUMENT)
        currentData = await postInput('1');
        currentData = await postInput('TG-OFF-001');
        currentData = await postInput('2');
        currentData = await postInput('4');
      } else if (type === 'PAYMENT') {
        // Press 1 -> enter TG-OFF-001 -> Press 2 -> enter 1 (REQUEST_UPI_PAYMENT)
        currentData = await postInput('1');
        currentData = await postInput('TG-OFF-001');
        currentData = await postInput('2');
        currentData = await postInput('1');
      } else if (type === 'FAILED_OFFICER') {
        // Press 1 -> enter TG-OFF-999
        currentData = await postInput('1');
        currentData = await postInput('TG-OFF-999');
      } else if (type === 'REPORT') {
        // Press 3 -> enter 1 (PAYMENT_DEMAND)
        currentData = await postInput('3');
        currentData = await postInput('1');
      } else if (type === 'LOCKOUT') {
        // Press 1 -> enter invalid code 5 times
        currentData = await postInput('1');
        for (let i = 0; i < 5; i++) {
          currentData = await postInput('INVALID-OFFICER');
          if (currentData.status === 'LOCKED') break;
        }
      }

      setSession(currentData);
      setCallHistory(history);
      speakPrompt(currentData.prompt);
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo scenario execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">TrustGov IVR Voice Gateway Simulator</h1>
            <span className="bg-amber-950/60 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              Demo IVR — Simulated Locally
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Accessibility Gateway: Enables citizens without smartphones or internet to verify officers and check safety over telephony.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              ttsEnabled
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Read prompts out loud using browser speech synthesis"
          >
            {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {ttsEnabled ? 'Speech Audio ON' : 'Speech Audio OFF'}
          </button>

          <button
            onClick={handleResetSimulator}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset State
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Status, Keypad, Call Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Phone Handset & Keypad (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${session && session.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Telephone Handset</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {session ? session.sessionId : 'ON HOOK'}
              </span>
            </div>

            {/* Input Display */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Dialpad / Input Buffer
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSendInput()}
                  placeholder={session ? "Enter digits or code (e.g. TG-OFF-001)" : "Click Start Call first"}
                  disabled={!session || session.status !== 'ACTIVE' || loading}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded-lg px-3 py-2 text-sm text-cyan-400 font-mono tracking-wider focus:outline-none"
                />
                <button
                  onClick={() => setInputValue('')}
                  disabled={!inputValue}
                  className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-300 bg-slate-950 border border-slate-800 rounded-lg disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* DTMF Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {[
                { key: '1', sub: '' },
                { key: '2', sub: 'ABC' },
                { key: '3', sub: 'DEF' },
                { key: '4', sub: 'GHI' },
                { key: '5', sub: 'JKL' },
                { key: '6', sub: 'MNO' },
                { key: '7', sub: 'PQRS' },
                { key: '8', sub: 'TUV' },
                { key: '9', sub: 'WXYZ' },
                { key: '*', sub: '' },
                { key: '0', sub: 'REPEAT' },
                { key: '#', sub: 'HASH' }
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => handleKeypadPress(btn.key)}
                  disabled={!session || session.status !== 'ACTIVE' || loading}
                  className="h-14 bg-slate-950 hover:bg-cyan-950/40 active:bg-cyan-900/60 border border-slate-800 hover:border-cyan-500/40 rounded-lg flex flex-col items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none group"
                >
                  <span className="text-lg font-bold text-white group-hover:text-cyan-400 font-mono">{btn.key}</span>
                  {btn.sub && <span className="text-[9px] text-slate-500 font-semibold tracking-widest">{btn.sub}</span>}
                </button>
              ))}
            </div>

            {/* Call Control Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {!session || session.status !== 'ACTIVE' ? (
                <button
                  onClick={handleStartCall}
                  disabled={loading}
                  className="col-span-2 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-lg shadow-emerald-950/50 transition-all"
                >
                  <Phone className="h-4 w-4" />
                  Start Call (Incoming Ring)
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleSendInput()}
                    disabled={loading || !inputValue.trim()}
                    className="flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg transition-all disabled:opacity-50"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    Send Input
                  </button>

                  <button
                    onClick={handleEndCall}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-all"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    End Call (9)
                  </button>
                </>
              )}
            </div>

            {session && session.status === 'ACTIVE' && (
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <button
                  onClick={handleRepeat}
                  disabled={loading}
                  className="hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Repeat Prompt (0)
                </button>
                <span className="text-[11px] text-slate-500">Auto-expires in 5 min</span>
              </div>
            )}
          </div>

          {/* Quick Scenario Runner */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <PlayCircle className="h-4 w-4 text-cyan-400" />
              Automated Demo Scenarios
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => runDemoScenario('VERIFY')}
                disabled={loading}
                className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 rounded-lg text-left transition-colors"
              >
                <div className="font-semibold text-emerald-400">Demo 1: Valid Officer</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Verify TG-OFF-001 & check Document action</div>
              </button>

              <button
                onClick={() => runDemoScenario('PAYMENT')}
                disabled={loading}
                className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-300 rounded-lg text-left transition-colors"
              >
                <div className="font-semibold text-rose-400">Demo 2: Prohibited Payment</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Test DENY + CRITICAL on UPI demand</div>
              </button>

              <button
                onClick={() => runDemoScenario('FAILED_OFFICER')}
                disabled={loading}
                className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 rounded-lg text-left transition-colors"
              >
                <div className="font-semibold text-amber-400">Demo 3: Non-existent Officer</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Check anti-enumeration generic failure</div>
              </button>

              <button
                onClick={() => runDemoScenario('REPORT')}
                disabled={loading}
                className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-slate-300 rounded-lg text-left transition-colors"
              >
                <div className="font-semibold text-purple-400">Demo 4: File Scam Report</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Directly report suspicious interaction</div>
              </button>

              <button
                onClick={() => runDemoScenario('LOCKOUT')}
                disabled={loading}
                className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-300 rounded-lg text-left sm:col-span-2 transition-colors"
              >
                <div className="font-semibold text-red-400">Demo 5: Security Lockout</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Demonstrate session locking after 5 failed attempts</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Active Session Card & Spoken Audio History (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Active Session Metadata Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Session Telemetry</span>
              {session && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  session.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' :
                  session.status === 'LOCKED' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' :
                  session.status === 'EXPIRED' ? 'bg-amber-950 text-amber-400 border border-amber-500/30' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {session.status}
                </span>
              )}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Session ID</span>
                <span className="font-mono text-cyan-400 font-bold truncate block">{session?.sessionId || '—'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">State</span>
                <span className="font-mono text-purple-400 font-bold truncate block">{session?.state || 'IDLE'}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Attempts</span>
                <span className="font-mono text-slate-300 font-bold">
                  {session ? `${session.attemptCount ?? 0} / ${session.maxAttempts ?? 5}` : '—'}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Identity</span>
                <span className={`font-mono font-bold ${
                  session?.verificationResult === 'VERIFIED' ? 'text-emerald-400' :
                  session?.verificationResult === 'FAILED' ? 'text-rose-400' :
                  session?.verificationResult === 'INCOMPLETE' ? 'text-amber-400' :
                  'text-slate-500'
                }`}>
                  {session?.verificationResult || '—'}
                </span>
              </div>
            </div>

            {/* Correlated Public References */}
            <div className="border-t border-slate-800 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-500">Vfy:</span>
                <span className="font-mono text-slate-300 truncate">{session?.verificationReference || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Lock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="text-slate-500">Auth:</span>
                <span className="font-mono text-slate-300 truncate">{session?.authorizationReference || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <FileText className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span className="text-slate-500">Report:</span>
                <span className="font-mono text-slate-300 truncate">{session?.reportReference || '—'}</span>
              </div>
            </div>
          </div>

          {/* Spoken Voice Feed / Speech Bubble */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col h-[400px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-cyan-400" />
                Live Telephone Voice Audio Stream
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Channel: DTMF/AUDIO</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {callHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs">
                  <Phone className="h-8 w-8 mb-2 stroke-1" />
                  <span>No active call in progress.</span>
                  <span className="text-[10px] mt-1 text-slate-700">Click "Start Call" or run a demo scenario.</span>
                </div>
              ) : (
                callHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${item.sender === 'CALLER' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                      <span>{item.sender === 'SYSTEM' ? 'TrustGov IVR Gateway' : 'Caller'}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        item.sender === 'CALLER'
                          ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 font-mono'
                          : 'bg-slate-950 border border-slate-800 text-slate-200 shadow'
                      }`}
                    >
                      {item.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            {session && session.options && session.options.length > 0 && (
              <div className="pt-3 border-t border-slate-800 mt-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1">Available Menu Options</span>
                <div className="flex flex-wrap gap-1.5">
                  {session.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendInput(opt.split(':')[0].trim())}
                      className="text-[11px] px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IvrSimulator;
