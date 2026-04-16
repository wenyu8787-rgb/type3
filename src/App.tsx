/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Trophy, User } from 'lucide-react';
import { db, auth, login } from './firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const WORDS = ['APPLE', 'BANANA', 'TIGER', 'ORANGE', 'GRAPE', 'LEMON', 'MELON', 'PEACH', 'CHERRY', 'BERRY'];
const QWERTY = [['Q','W','E','R','T','Y','U','I','O','P'], ['A','S','D','F','G','H','J','K','L'], ['Z','X','C','V','B','N','M']];

// Simple Audio Helper
const playSound = (type: 'correct' | 'wrong' | 'gameover') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (type === 'correct') { osc.frequency.value = 600; gain.gain.value = 0.1; }
  else if (type === 'wrong') { osc.frequency.value = 200; gain.gain.value = 0.1; }
  else { osc.frequency.value = 100; gain.gain.value = 0.2; }
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

type ActiveWord = {
  id: number;
  word: string;
  hiddenIndex: number;
  hiddenChar: string;
  x: number;
  y: number;
  speed: number;
};

export default function App() {
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [activeWords, setActiveWords] = useState<ActiveWord[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{score: number, date: string, playerName: string}[]>([]);
  const [user, setUser] = useState(auth.currentUser);
  const requestRef = useRef<number>();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'scores'), orderBy('score', 'desc'), limit(5)), (snapshot) => {
      const scores = snapshot.docs.map(doc => doc.data() as {score: number, date: string, playerName: string});
      setLeaderboard(scores);
    });
    return () => unsubscribe();
  }, []);

  const saveScore = async (finalScore: number) => {
    if (user) {
      await addDoc(collection(db, 'scores'), {
        score: finalScore,
        date: new Date().toLocaleDateString(),
        playerName: user.displayName || 'Anonymous'
      });
    }
  };

  const spawnWord = useCallback(() => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const hiddenIndex = Math.floor(Math.random() * word.length);
    const newWord: ActiveWord = {
      id: Date.now(),
      word,
      hiddenIndex,
      hiddenChar: word[hiddenIndex],
      x: Math.random() * (window.innerWidth - 100),
      y: -50,
      speed: 1 + Math.random() * 2,
    };
    setActiveWords((prev) => [...prev, newWord]);
  }, []);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(spawnWord, 2000);
    return () => clearInterval(interval);
  }, [spawnWord, gameOver]);

  const animate = useCallback(() => {
    setActiveWords((prev) => {
      const nextWords = prev
        .map((w) => ({ ...w, y: w.y + w.speed }))
        .filter((w) => {
          if (w.y > window.innerHeight - 250) {
            setLives((l) => {
              const newLives = Math.max(0, l - 1);
              if (newLives === 0) playSound('gameover');
              else playSound('wrong');
              return newLives;
            });
            return false;
          }
          return true;
        });
      return nextWords;
    });
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (lives <= 0) {
      setGameOver(true);
      saveScore(score);
    }
  }, [lives]);

  useEffect(() => {
    if (!gameOver) {
      requestRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(requestRef.current!);
    }
  }, [animate, gameOver]);

  const handleInput = (char: string) => {
    if (gameOver) return;
    const upperChar = char.toUpperCase();
    let hit = false;
    setActiveWords((prev) => {
      const nextWords = [...prev];
      for (let i = 0; i < nextWords.length; i++) {
        if (nextWords[i].hiddenChar === upperChar) {
          setScore((s) => s + 10);
          nextWords.splice(i, 1);
          hit = true;
          playSound('correct');
          break;
        }
      }
      if (!hit) playSound('wrong');
      return nextWords;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => handleInput(e.key);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  return (
    <div className="min-h-screen bg-[#111827] text-white flex flex-col font-sans">
      <div className="flex justify-between p-6 bg-[#0f172a] border-b border-[#334155]">
        <div className="text-2xl font-bold tracking-wider">
          SCORE: <span className="text-blue-400">{score.toString().padStart(3, '0')}</span>
        </div>
        <div className="flex gap-4 items-center">
          {user ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <User size={16} /> {user.displayName}
            </div>
          ) : (
            <button onClick={login} className="text-sm bg-blue-600 px-3 py-1 rounded">Login</button>
          )}
          <div className="flex gap-2">
            {[...Array(3)].map((_, i) => (
              <Heart key={i} className={i < lives ? 'text-red-500 fill-red-500' : 'text-gray-700'} size={30} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex-grow relative overflow-hidden bg-[radial-gradient(circle_at_50%_20%,#1e293b_0%,#111827_100%)]">
        {activeWords.map((w) => (
          <div key={w.id} className="absolute text-4xl font-extrabold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" style={{ left: w.x, top: w.y }}>
            {w.word.split('').map((char, i) => (
              <span key={i} className={i === w.hiddenIndex ? 'text-[#fbbf24] underline underline-offset-8' : ''}>
                {i === w.hiddenIndex ? '_' : char}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="p-6 bg-[#0f172a] flex flex-col gap-3 items-center border-t border-[#334155]">
        {QWERTY.map((row, i) => (
          <div key={i} className="flex gap-2">
            {row.map((char) => (
              <button key={char} onClick={() => handleInput(char)} className="bg-[#334155] hover:bg-[#475569] w-14 h-14 rounded-lg text-2xl font-bold border-b-4 border-[#1e293b] active:translate-y-1 active:border-b-0 transition-all">
                {char}
              </button>
            ))}
          </div>
        ))}
      </div>
      {gameOver && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 z-50">
          <h1 className="text-6xl font-black text-white mb-4 tracking-tighter">GAME OVER</h1>
          <div className="bg-[#1e293b] p-8 rounded-2xl w-full max-w-sm mb-8 border border-[#334155]">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white"><Trophy className="text-yellow-500" /> Leaderboard</h2>
            {leaderboard.map((entry, i) => (
              <div key={i} className="flex justify-between border-b border-[#334155] py-3 text-lg">
                <span className="text-gray-400">{entry.playerName}</span>
                <span className="font-bold text-blue-400">{entry.score}</span>
              </div>
            ))}
          </div>
          <button onClick={() => window.location.reload()} className="px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-full text-xl font-bold transition-colors">PLAY AGAIN</button>
        </div>
      )}
    </div>
  );
}
