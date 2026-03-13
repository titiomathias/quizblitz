import { useState, useEffect, useRef, useCallback } from "react";
import { ref, push, onChildAdded, off, remove } from "firebase/database";
import { db } from "./firebase";
import "./styles.css";

// ─── Utility helpers ───
const generateRoomCode = () => String(Math.floor(100000 + Math.random() * 900000));
const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
const SHAPES = ["▲", "◆", "●", "■"];
const SENDER_ID = Math.random().toString(36).substring(2, 15);

// ─── Firebase Communication Layer ───
function useFirebase(roomCode, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomCode || roomCode.length < 6) return;
    const messagesRef = ref(db, `rooms/${roomCode}/messages`);

    // Record when the listener was attached so we can skip messages that
    // already existed in Firebase (prevents stale-message replay on attach
    // and covers the race window between remove() and onChildAdded()).
    const attachedAt = Date.now();

    const callback = (snapshot) => {
      const msg = snapshot.val();
      if (!msg) return;
      // Skip messages older than 5 s relative to when we attached.
      // This discards any pre-existing children fired by onChildAdded on
      // attach, while still accepting messages sent around the same time.
      if (msg.ts && msg.ts < attachedAt - 5000) return;
      if (msg.senderId !== SENDER_ID) {
        onMessageRef.current(msg);
      }
    };

    onChildAdded(messagesRef, callback);

    return () => off(messagesRef, "child_added", callback);
  }, [roomCode]);

  const send = useCallback((msg) => {
    if (!roomCode) return;
    const messagesRef = ref(db, `rooms/${roomCode}/messages`);
    // Include a client-side timestamp so receivers can filter stale messages.
    push(messagesRef, { ...msg, senderId: SENDER_ID, ts: Date.now() });
  }, [roomCode]);

  return send;
}

// ─── Scoring (Kahoot-style: faster = more points, max 1000) ───
function calcScore(timeLeft, totalTime) {
  const ratio = timeLeft / totalTime;
  return Math.round(1000 * ratio);
}

// ─── Background particles ───
function Particles() {
  const particles = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 4 + Math.random() * 12,
      dur: 8 + Math.random() * 16,
      delay: Math.random() * -20,
      shape: Math.floor(Math.random() * 4),
      opacity: 0.08 + Math.random() * 0.12,
    }))
  ).current;
  return (
    <div className="particles-wrap">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: COLORS[p.shape],
            borderRadius: p.shape === 2 ? "50%" : p.shape === 0 ? "0" : "2px",
            opacity: p.opacity,
            transform: p.shape === 0 ? "rotate(45deg)" : "none",
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Confetti ───
function Confetti() {
  const pieces = useRef(
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * 4)],
      size: 6 + Math.random() * 10,
      dur: 2 + Math.random() * 3,
      delay: Math.random() * 1.5,
    }))
  ).current;
  return (
    <div className="confetti-wrap">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: "-20px",
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: "2px",
            animation: `confetti ${p.dur}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Countdown Overlay ───
function CountdownOverlay({ count }) {
  return (
    <div className="countdown-overlay">
      <div key={count} className="countdown-number">
        {count === 0 ? "GO!" : count}
      </div>
    </div>
  );
}

// ─── Button ───
function Btn({ children, onClick, color = "#1368ce", style = {}, disabled = false, big = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn ${big ? "btn-big" : ""}`}
      style={{
        background: disabled ? "#666" : color,
        boxShadow: disabled ? "none" : `0 4px 0 ${adjustColor(color, -40)}, 0 6px 20px rgba(0,0,0,0.2)`,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ─── JSON template ───
const JSON_EXAMPLE = `{
  "title": "Quiz de Exemplo",
  "questions": [
    {
      "question": "Qual é a capital do Brasil?",
      "image": "",
      "time": 20,
      "options": ["São Paulo", "Brasília", "Rio de Janeiro", "Salvador"],
      "correct": 1
    },
    {
      "question": "Quanto é 7 × 8?",
      "image": "",
      "time": 15,
      "options": ["54", "56", "58", "62"],
      "correct": 1
    },
    {
      "question": "Qual destes é um planeta gasoso?",
      "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/800px-Saturn_during_Equinox.jpg",
      "time": 20,
      "options": ["Marte", "Vênus", "Saturno", "Mercúrio"],
      "correct": 2
    }
  ]
}`;

// ════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("home");
  const [quiz, setQuiz] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [countdownVal, setCountdownVal] = useState(3);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [jsonText, setJsonText] = useState(JSON_EXAMPLE);
  const [jsonError, setJsonError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [lastPoints, setLastPoints] = useState(0);
  const [wasCorrect, setWasCorrect] = useState(null);
  const timerRef = useRef(null);
  const quizRef = useRef(null);
  const currentQRef = useRef(0);
  const playersRef = useRef({});
  const isHostRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { quizRef.current = quiz; }, [quiz]);
  useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  // ─── Broadcast handler ───
  // Uses isHostRef (not the closed-over isHost) so the callback never goes
  // stale between renders and role-based guards are always up-to-date.
  const handleMessage = useCallback((msg) => {
    const asHost = isHostRef.current;
    switch (msg.type) {
      // ── Messages only the HOST should process (sent by players) ──
      case "PLAYER_JOIN":
        if (!asHost) break;
        setPlayers((prev) => ({ ...prev, [msg.name]: { score: 0, streak: 0, lastAnswer: null } }));
        break;
      case "PLAYER_ANSWER":
        if (!asHost) break;
        setPlayers((prev) => {
          const p = { ...prev };
          if (p[msg.name]) {
            const q = quizRef.current?.questions[currentQRef.current];
            if (!q) return p;
            const correct = msg.answer === q.correct;
            const pts = correct ? calcScore(msg.timeLeft, q.time) : 0;
            const streak = correct ? (p[msg.name].streak || 0) + 1 : 0;
            const bonus = streak >= 3 ? Math.round(pts * 0.1) : 0;
            p[msg.name] = {
              ...p[msg.name],
              score: (p[msg.name].score || 0) + pts + bonus,
              streak,
              lastAnswer: msg.answer,
              lastCorrect: correct,
              lastPoints: pts + bonus,
            };
          }
          return p;
        });
        setAnsweredCount((c) => c + 1);
        break;

      // ── Messages only PLAYERS should process (sent by the host) ──
      case "PLAYER_LIST":
        if (asHost) break;
        if (msg.players && typeof msg.players === "object" && !Array.isArray(msg.players)) {
          setPlayers(msg.players);
        }
        break;
      case "GAME_START":
        if (asHost) break;
        setQuiz(msg.quiz);
        setScreen("countdown");
        setCountdownVal(3);
        break;
      case "NEXT_QUESTION":
        if (asHost) break;
        setCurrentQ(msg.qIndex);
        setTimeLeft(msg.time);
        setSelectedAnswer(null);
        setShowCorrect(false);
        setWasCorrect(null);
        setScreen("question");
        break;
      case "SHOW_RESULTS":
        if (asHost) break;
        if (msg.players && typeof msg.players === "object") {
          setPlayers(msg.players);
          const me = msg.players[playerName];
          if (me) {
            setMyScore(me.score);
            setMyStreak(me.streak);
            setLastPoints(me.lastPoints || 0);
            setWasCorrect(me.lastCorrect ?? null);
          }
        }
        setShowCorrect(true);
        setScreen("answer-result");
        break;
      case "SHOW_SCOREBOARD":
        if (asHost) break;
        if (msg.players && typeof msg.players === "object") setPlayers(msg.players);
        setScreen("scoreboard");
        break;
      case "SHOW_FINAL":
        if (asHost) break;
        if (msg.players && typeof msg.players === "object") setPlayers(msg.players);
        setScreen("final");
        break;
      case "TIME_UPDATE":
        if (asHost) break;
        setTimeLeft(msg.timeLeft);
        break;
    }
  }, [playerName]);

  const send = useFirebase(roomCode || joinCode, handleMessage);

  // Sync player list to clients
  useEffect(() => {
    if (isHost && Object.keys(players).length > 0) {
      send({ type: "PLAYER_LIST", players });
    }
  }, [players, isHost, send]);

  // ─── Host: Create Room ───
  async function handleCreateQuiz() {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setJsonError("JSON precisa ter 'title' e 'questions' (array não vazio).");
        return;
      }
      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i];
        if (!q.question || !q.options || q.options.length < 2 || q.correct === undefined) {
          setJsonError(`Pergunta ${i + 1} incompleta. Precisa de 'question', 'options' (2-4) e 'correct'.`);
          return;
        }
        if (!q.time) q.time = 20;
      }
      setJsonError("");
      const code = generateRoomCode();

      // Await the removal so the listener never attaches to a path that still
      // has messages from a previous session with the same code.
      try { await remove(ref(db, `rooms/${code}`)); } catch (_) { /* ignore */ }

      setQuiz(parsed);
      setRoomCode(code);
      setIsHost(true);
      setPlayers({});
      setCurrentQ(0);
      setScreen("host-lobby");
    } catch (e) {
      setJsonError("JSON inválido: " + e.message);
    }
  }

  // ─── Player: Join Room ───
  function handleJoinRoom() {
    if (!joinCode || joinCode.length < 4) { setJoinError("Digite um código de sala válido."); return; }
    if (!playerName.trim()) { setJoinError("Digite seu nome."); return; }
    setJoinError("");
    setRoomCode(joinCode);
    setIsHost(false);
    setMyScore(0);
    setMyStreak(0);
    setScreen("player-lobby");
  }

  // Notify host about player joining
  useEffect(() => {
    if (screen === "player-lobby" && roomCode && playerName && !isHost) {
      send({ type: "PLAYER_JOIN", name: playerName.trim() });
    }
  }, [screen, roomCode, playerName, isHost, send]);

  // ─── Host: Start Game ───
  function handleStartGame() {
    send({ type: "GAME_START", quiz });
    setScreen("countdown");
    setCountdownVal(3);
  }

  // ─── Countdown ───
  useEffect(() => {
    if (screen !== "countdown") return;
    if (countdownVal < 0) {
      if (isHost) startQuestion(0);
      return;
    }
    const t = setTimeout(() => setCountdownVal((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, countdownVal]);

  // ─── Start question ───
  function startQuestion(qIndex) {
    const q = quizRef.current?.questions[qIndex];
    if (!q) return;
    setCurrentQ(qIndex);
    setTimeLeft(q.time);
    setSelectedAnswer(null);
    setShowCorrect(false);
    setAnsweredCount(0);
    setWasCorrect(null);
    setScreen("question");

    if (isHost) {
      send({ type: "NEXT_QUESTION", qIndex, time: q.time });
      clearInterval(timerRef.current);
      let tl = q.time;
      timerRef.current = setInterval(() => {
        tl--;
        setTimeLeft(tl);
        send({ type: "TIME_UPDATE", timeLeft: tl });
        if (tl <= 0) {
          clearInterval(timerRef.current);
          handleTimeUp();
        }
      }, 1000);
    }
  }

  function handleTimeUp() {
    clearInterval(timerRef.current);
    if (isHost) {
      const p = playersRef.current;
      send({ type: "SHOW_RESULTS", players: p });
      setShowCorrect(true);
      setScreen("answer-result");
    }
  }

  // ─── Player answer ───
  function handleSelectAnswer(idx) {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    const q = quiz.questions[currentQ];
    const correct = idx === q.correct;
    const pts = correct ? calcScore(timeLeft, q.time) : 0;
    const newStreak = correct ? myStreak + 1 : 0;
    const bonus = newStreak >= 3 ? Math.round(pts * 0.1) : 0;
    setLastPoints(pts + bonus);
    setWasCorrect(correct);
    setMyScore((s) => s + pts + bonus);
    setMyStreak(newStreak);
    send({ type: "PLAYER_ANSWER", name: playerName, answer: idx, timeLeft });
  }

  function handleShowScoreboard() {
    setScreen("scoreboard");
    send({ type: "SHOW_SCOREBOARD", players });
  }

  function handleNextQuestion() {
    const nextQ = currentQ + 1;
    if (nextQ >= quiz.questions.length) {
      handleShowFinal();
    } else {
      // Show scoreboard to players, then countdown
      send({ type: "SHOW_SCOREBOARD", players });
      setScreen("countdown");
      setCountdownVal(3);
      // After countdown finishes, startQuestion will be called via the countdown effect
      // We need to queue the next question index
      currentQRef.current = nextQ;
      setTimeout(() => startQuestion(nextQ), 3600);
    }
  }

  function handleShowFinal() {
    setScreen("final");
    setShowConfetti(true);
    send({ type: "SHOW_FINAL", players });
    setTimeout(() => setShowConfetti(false), 5000);
  }

  function handleRevealAnswer() {
    clearInterval(timerRef.current);
    setShowCorrect(true);
    setScreen("answer-result");
    send({ type: "SHOW_RESULTS", players });
  }

  const sortedPlayers = (players && typeof players === "object" && !Array.isArray(players)
    ? Object.entries(players)
    : []
  )
    .map(([name, data]) => ({ name, ...(data || {}) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  function goHome() {
    clearInterval(timerRef.current);
    setScreen("home");
    setQuiz(null);
    setRoomCode("");
    setPlayers({});
    setCurrentQ(0);
    setIsHost(false);
    setMyScore(0);
    setMyStreak(0);
    setShowConfetti(false);
  }

  // ════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════
  return (
    <div className="app-root">
      <Particles />
      {showConfetti && <Confetti />}
      {screen === "countdown" && countdownVal >= 0 && <CountdownOverlay count={countdownVal} />}

      <div className="app-content">

        {/* ═══ HOME ═══ */}
        {screen === "home" && (
          <div className="screen-center">
            <div className="anim-pop" style={{ textAlign: "center" }}>
              <h1 className="logo-title">QuizBlitz</h1>
              <p className="logo-subtitle">Quiz Interativo em Tempo Real</p>
            </div>
            <div className="home-actions anim-slide-up-d2">
              <Btn big color="#e21b3c" onClick={() => setScreen("create")} style={{ width: "100%" }}>
                🎯 Criar Quiz
              </Btn>
              <div className="glass-card">
                <p style={{ fontWeight: 700, fontSize: "18px", marginBottom: "14px", textAlign: "center" }}>
                  Entrar em uma Sala
                </p>
                <input
                  className="input-code"
                  placeholder="Código da sala"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
                <input
                  className="input-name"
                  placeholder="Seu nome"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                  maxLength={20}
                />
                {joinError && <p className="error-text">{joinError}</p>}
                <Btn big color="#26890c" onClick={handleJoinRoom} style={{ width: "100%" }}>
                  Entrar →
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CREATE ═══ */}
        {screen === "create" && (
          <div className="screen-create">
            <div className="create-header anim-slide-down">
              <button className="back-btn" onClick={goHome}>←</button>
              <h2 className="section-title">Criar Quiz</h2>
            </div>
            <div className="glass-card anim-slide-up" style={{ width: "100%" }}>
              <p style={{ fontWeight: 700, marginBottom: "8px", fontSize: "16px" }}>Cole seu JSON abaixo:</p>
              <p className="text-muted" style={{ marginBottom: "14px", fontSize: "13px" }}>
                Campos: title, questions[].question, .options (2-4), .correct (índice), .time (seg), .image (url, opcional)
              </p>
              <textarea
                className="json-editor"
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setJsonError(""); }}
                spellCheck={false}
              />
              {jsonError && <p className="error-box">⚠️ {jsonError}</p>}
              <div style={{ marginTop: "16px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <Btn color="#666" onClick={() => setJsonText(JSON_EXAMPLE)}>Exemplo</Btn>
                <Btn big color="#26890c" onClick={handleCreateQuiz}>Criar Sala 🚀</Btn>
              </div>
            </div>
          </div>
        )}

        {/* ═══ HOST LOBBY ═══ */}
        {screen === "host-lobby" && (
          <div className="screen-center">
            <div className="anim-pop" style={{ textAlign: "center" }}>
              <p className="label-upper">Código da Sala</p>
              <div className="room-code-display">{roomCode}</div>
              <p className="text-muted" style={{ marginTop: "4px" }}>📋 Compartilhe este código</p>
            </div>
            <div className="glass-card anim-slide-up-d2" style={{ width: "100%", maxWidth: "500px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <p style={{ fontWeight: 700, fontSize: "18px" }}>Jogadores ({Object.keys(players).length})</p>
                <div className="pulse-dot" />
              </div>
              {Object.keys(players).length === 0 ? (
                <p className="text-muted" style={{ textAlign: "center", padding: "30px 0" }}>Aguardando jogadores...</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {Object.keys(players).map((name, i) => (
                    <div key={name} className="player-chip" style={{
                      background: COLORS[i % 4],
                      boxShadow: `0 3px 0 ${adjustColor(COLORS[i % 4], -40)}`,
                      animationDelay: `${i * 0.1}s`,
                    }}>{name}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="anim-slide-up-d4" style={{ display: "flex", gap: "12px" }}>
              <Btn color="#666" onClick={goHome}>Cancelar</Btn>
              <Btn big color="#26890c" onClick={handleStartGame} disabled={Object.keys(players).length === 0}>
                Iniciar Quiz ▶
              </Btn>
            </div>
            <p className="quiz-info-bar">
              Quiz: <strong>{quiz?.title}</strong> — {quiz?.questions.length} perguntas
            </p>
          </div>
        )}

        {/* ═══ PLAYER LOBBY ═══ */}
        {screen === "player-lobby" && (
          <div className="screen-center">
            <div className="anim-pop" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(48px, 8vw, 72px)", animation: "pulse 2s infinite" }}>🎮</div>
              <h2 className="section-title" style={{ marginTop: "12px" }}>{playerName}</h2>
              <p className="text-muted" style={{ marginTop: "8px" }}>
                Sala <span style={{ color: "#ffd93d", fontWeight: 800 }}>{joinCode}</span>
              </p>
            </div>
            <div className="glass-card anim-slide-up-d2" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="pulse-dot" style={{ background: "#ffd93d" }} />
              <p style={{ fontWeight: 700, fontSize: "18px" }}>Aguardando o host iniciar...</p>
            </div>
            <Btn color="#666" onClick={goHome} style={{ animationDelay: "0.4s" }}>Sair</Btn>
          </div>
        )}

        {/* ═══ QUESTION ═══ */}
        {screen === "question" && quiz && (
          <div className="screen-question">
            {/* Top bar */}
            <div className="question-topbar anim-slide-down">
              <div className="topbar-pill">{currentQ + 1} / {quiz.questions.length}</div>
              <div className={`topbar-timer ${timeLeft <= 5 ? "timer-danger" : ""}`}>
                <span style={{ fontSize: "22px" }}>⏱</span>
                <span className="timer-number" style={{ color: timeLeft <= 5 ? "#ff6b6b" : "#fff" }}>
                  {timeLeft}
                </span>
              </div>
              {isHost && <div className="topbar-pill">✅ {answeredCount}/{Object.keys(players).length}</div>}
              {!isHost && <div className="topbar-pill">🏆 {myScore}</div>}
            </div>

            {/* Timer bar */}
            <div className="timer-bar-bg">
              <div
                className="timer-bar-fill"
                style={{
                  background: timeLeft <= 5 ? "#e21b3c" : "linear-gradient(90deg, #ffd93d, #26890c)",
                  width: `${(timeLeft / (quiz.questions[currentQ]?.time || 20)) * 100}%`,
                }}
              />
            </div>

            {/* Image */}
            {quiz.questions[currentQ]?.image && (
              <div className="question-image-wrap anim-slide-down">
                <img
                  src={quiz.questions[currentQ].image}
                  alt="Imagem da pergunta"
                  className="question-image"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            )}

            {/* Question text */}
            <div className="question-text-box anim-pop">
              <p className="question-text">{quiz.questions[currentQ]?.question}</p>
            </div>

            {/* Options */}
            <div className={`options-grid ${quiz.questions[currentQ]?.options.length <= 2 ? "options-single" : ""}`}>
              {quiz.questions[currentQ]?.options.map((opt, i) => {
                const isSelected = selectedAnswer === i;
                const disabled = selectedAnswer !== null || isHost;
                const correct = quiz.questions[currentQ].correct === i;
                let bg = COLORS[i];
                if (showCorrect) bg = correct ? "#26890c" : "rgba(100,100,100,0.4)";
                else if (isSelected) bg = adjustColor(COLORS[i], -30);

                return (
                  <button
                    key={i}
                    onClick={() => !disabled && handleSelectAnswer(i)}
                    disabled={disabled}
                    className="option-btn"
                    style={{
                      background: bg,
                      boxShadow: showCorrect && correct
                        ? "0 0 30px rgba(38,137,12,0.5), 0 4px 0 #1a6408"
                        : `0 4px 0 ${adjustColor(bg, -40)}`,
                      transform: isSelected ? "scale(0.97)" : "scale(1)",
                      animationDelay: `${i * 0.08}s`,
                      opacity: showCorrect && !correct ? 0.5 : 1,
                    }}
                  >
                    <span className="option-shape">{SHAPES[i]}</span>
                    <span className="option-label">{opt}</span>
                    {showCorrect && correct && <span style={{ marginLeft: "auto", fontSize: "24px" }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Host controls */}
            {isHost && (
              <div className="host-controls anim-slide-up-d3">
                {!showCorrect ? (
                  <Btn color="#d89e00" onClick={handleRevealAnswer}>Revelar Resposta</Btn>
                ) : (
                  <>
                    <Btn color="#1368ce" onClick={handleShowScoreboard}>📊 Placar</Btn>
                    <Btn color="#26890c" onClick={handleNextQuestion}>
                      {currentQ + 1 >= quiz.questions.length ? "🏆 Resultado Final" : "Próxima →"}
                    </Btn>
                  </>
                )}
              </div>
            )}

            {/* Player waiting */}
            {!isHost && selectedAnswer !== null && !showCorrect && (
              <div className="waiting-badge anim-pop">
                <p style={{ fontWeight: 700, fontSize: "18px" }}>✓ Resposta enviada! Aguardando...</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ ANSWER RESULT (Player) ═══ */}
        {screen === "answer-result" && !isHost && (
          <div
            className="screen-center"
            style={{ animation: wasCorrect ? "correctFlash 1s ease" : wasCorrect === false ? "wrongShake 0.5s ease" : "none" }}
          >
            <div className="anim-pop" style={{ fontSize: "clamp(60px, 12vw, 100px)" }}>
              {wasCorrect ? "🎉" : "😢"}
            </div>
            <h2 className="result-title" style={{ color: wasCorrect ? "#6bcb77" : "#ff6b6b" }}>
              {wasCorrect ? "Correto!" : "Incorreto!"}
            </h2>
            {wasCorrect && lastPoints > 0 && (
              <div className="points-badge anim-pop-d2">+{lastPoints} pts</div>
            )}
            {myStreak >= 3 && (
              <div className="streak-badge">🔥 Sequência de {myStreak}!</div>
            )}
            <div className="glass-card anim-slide-up-d4">
              <span style={{ fontWeight: 800, fontSize: "20px" }}>Total: {myScore} pts</span>
            </div>
            <p className="text-muted anim-slide-up-d5">Aguardando próxima etapa...</p>
          </div>
        )}

        {/* ═══ ANSWER RESULT (Host) ═══ */}
        {screen === "answer-result" && isHost && quiz && (
          <div className="screen-question">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div className="topbar-pill">{currentQ + 1} / {quiz.questions.length}</div>
              <p style={{ fontWeight: 700, color: "#ffd93d" }}>⏱ Tempo esgotado</p>
            </div>
            <div className="question-text-box" style={{ marginBottom: "14px" }}>
              <p className="question-text" style={{ fontSize: "clamp(16px, 2.5vw, 24px)" }}>
                {quiz.questions[currentQ]?.question}
              </p>
            </div>
            <div className={`options-grid ${quiz.questions[currentQ]?.options.length <= 2 ? "options-single" : ""}`}>
              {quiz.questions[currentQ]?.options.map((opt, i) => {
                const correct = quiz.questions[currentQ].correct === i;
                const answerCount = Object.values(players).filter((p) => p.lastAnswer === i).length;
                return (
                  <div
                    key={i}
                    className="option-result"
                    style={{
                      background: correct ? "#26890c" : "rgba(100,100,100,0.3)",
                      opacity: correct ? 1 : 0.6,
                      boxShadow: correct ? "0 0 20px rgba(38,137,12,0.4)" : "none",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    <span className="option-shape">{SHAPES[i]}</span>
                    <span style={{ fontWeight: 700, flex: 1 }}>{opt}</span>
                    <span className="answer-count">{answerCount}</span>
                    {correct && <span style={{ fontSize: "20px" }}>✓</span>}
                  </div>
                );
              })}
            </div>
            <div className="host-controls anim-slide-up-d3">
              <Btn color="#1368ce" onClick={handleShowScoreboard}>📊 Placar</Btn>
              <Btn big color="#26890c" onClick={handleNextQuestion}>
                {currentQ + 1 >= quiz.questions.length ? "🏆 Resultado Final" : "Próxima →"}
              </Btn>
            </div>
          </div>
        )}

        {/* ═══ SCOREBOARD ═══ */}
        {screen === "scoreboard" && (
          <div className="screen-scoreboard">
            <h2 className="section-title anim-pop">📊 Placar</h2>
            <p className="text-muted anim-slide-down">
              Após pergunta {currentQ + 1} de {quiz?.questions.length}
            </p>
            <div className="scoreboard-list">
              {sortedPlayers.map((p, i) => (
                <div
                  key={p.name}
                  className={`scoreboard-row ${i === 0 ? "scoreboard-first" : ""}`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className={`rank-circle rank-${i < 3 ? i : "other"}`}>{i + 1}</div>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: "17px" }}>{p.name}</span>
                  {p.streak >= 3 && <span style={{ fontSize: "14px" }}>🔥{p.streak}</span>}
                  <span className={`score-value ${i === 0 ? "score-gold" : ""}`}>{p.score || 0}</span>
                </div>
              ))}
            </div>
            {isHost && (
              <div className="anim-slide-up-d5" style={{ marginTop: "24px" }}>
                <Btn big color="#26890c" onClick={handleNextQuestion}>
                  {currentQ + 1 >= quiz?.questions.length ? "🏆 Resultado Final" : "Próxima Pergunta →"}
                </Btn>
              </div>
            )}
            {!isHost && <p className="text-muted anim-slide-up-d5" style={{ marginTop: "24px" }}>Aguardando o host...</p>}
          </div>
        )}

        {/* ═══ FINAL ═══ */}
        {screen === "final" && (
          <div className="screen-scoreboard">
            <div className="anim-pop" style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ fontSize: "clamp(48px, 8vw, 72px)", marginBottom: "8px" }}>🏆</div>
              <h2 className="final-title">Resultado Final</h2>
              <p className="text-muted">{quiz?.title}</p>
            </div>

            {/* Podium */}
            {sortedPlayers.length >= 1 && (
              <div className="podium anim-slide-up-d2">
                {sortedPlayers[1] && (
                  <div className="podium-slot">
                    <p className="podium-name">{sortedPlayers[1].name}</p>
                    <div className="podium-bar podium-2nd">
                      <span className="podium-rank">2</span>
                      <span className="podium-score">{sortedPlayers[1].score || 0}</span>
                    </div>
                  </div>
                )}
                <div className="podium-slot">
                  <div style={{ fontSize: "32px", marginBottom: "4px" }}>👑</div>
                  <p className="podium-name" style={{ color: "#ffd93d" }}>{sortedPlayers[0]?.name}</p>
                  <div className="podium-bar podium-1st">
                    <span className="podium-rank" style={{ fontSize: "36px" }}>1</span>
                    <span className="podium-score">{sortedPlayers[0]?.score || 0}</span>
                  </div>
                </div>
                {sortedPlayers[2] && (
                  <div className="podium-slot">
                    <p className="podium-name">{sortedPlayers[2].name}</p>
                    <div className="podium-bar podium-3rd">
                      <span className="podium-rank">3</span>
                      <span className="podium-score">{sortedPlayers[2].score || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full list */}
            <div className="scoreboard-list">
              {sortedPlayers.map((p, i) => (
                <div
                  key={p.name}
                  className={`scoreboard-row ${i === 0 ? "scoreboard-first" : ""}`}
                  style={{ animationDelay: `${0.4 + i * 0.06}s` }}
                >
                  <span className={`final-rank rank-color-${i < 3 ? i : "other"}`}>{i + 1}º</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
                  <span className={`score-value ${i === 0 ? "score-gold" : ""}`}>{p.score || 0} pts</span>
                </div>
              ))}
            </div>
            <Btn big color="#e21b3c" onClick={goHome} style={{ marginTop: "30px" }}>
              🏠 Voltar ao Início
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
