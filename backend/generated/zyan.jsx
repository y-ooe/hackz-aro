function App() {
  const styles = {
    wrap: { maxWidth: 480, margin: '0 auto', padding: 20, fontFamily: 'sans-serif', color: '#1f2937' },
    card: { background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
    title: { textAlign: 'center', fontSize: 26, fontWeight: 700, marginBottom: 16, color: '#4f46e5' },
    question: { fontSize: 40, fontWeight: 700, textAlign: 'center', margin: '24px 0' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    opt: (state) => ({ padding: '16px 0', fontSize: 22, fontWeight: 600, borderRadius: 12, border: '2px solid #e5e7eb', cursor: state ? 'default' : 'pointer', background: state === 'correct' ? '#dcfce7' : state === 'wrong' ? '#fee2e2' : '#f9fafb', color: state === 'correct' ? '#16a34a' : state === 'wrong' ? '#dc2626' : '#1f2937', transition: 'all .15s' }),
    bar: { display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14, color: '#6b7280' },
    btn: { width: '100%', padding: '14px 0', fontSize: 18, fontWeight: 700, borderRadius: 12, border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', marginTop: 16 },
    diff: { display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 },
    diffBtn: (on) => ({ padding: '8px 14px', borderRadius: 999, border: '2px solid #4f46e5', background: on ? '#4f46e5' : '#fff', color: on ? '#fff' : '#4f46e5', cursor: 'pointer', fontWeight: 600 })
  };

  const TOTAL = 10;
  const LEVELS = { やさしい: 10, ふつう: 30, むずかしい: 99 };

  const [level, setLevel] = useState('ふつう');
  const [started, setStarted] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [picked, setPicked] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [done, setDone] = useState(false);

  const makeQuiz = () => {
    const max = LEVELS[level];
    const ops = ['+', '-', '\u00d7'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * max) + 1;
    let b = Math.floor(Math.random() * max) + 1;
    if (op === '\u00d7') { a = Math.floor(Math.random() * (max < 30 ? 9 : 13)) + 1; b = Math.floor(Math.random() * (max < 30 ? 9 : 13)) + 1; }
    if (op === '-' && b > a) { const t = a; a = b; b = t; }
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const set = new Set([ans]);
    while (set.size < 4) {
      const delta = Math.floor(Math.random() * 11) - 5;
      const cand = ans + delta;
      if (cand >= 0) set.add(cand);
    }
    const opts = [...set].sort(() => Math.random() - 0.5);
    return { a, b, op, ans, opts };
  };

  const start = () => {
    setStarted(true);
    setDone(false);
    setQIndex(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPicked(null);
    setQuiz(makeQuiz());
  };

  const pick = (v) => {
    if (picked !== null) return;
    setPicked(v);
    if (v === quiz.ans) {
      setScore((s) => s + 10 + combo * 2);
      setCombo((c) => { const nc = c + 1; setMaxCombo((m) => Math.max(m, nc)); return nc; });
    } else {
      setCombo(0);
    }
  };

  const next = () => {
    if (qIndex + 1 >= TOTAL) {
      setDone(true);
      return;
    }
    setQIndex((i) => i + 1);
    setPicked(null);
    setQuiz(makeQuiz());
  };

  if (!started) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>\u{1F9EE} \u6570\u5b66\u30af\u30a4\u30ba</div>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>\u5168{TOTAL}\u554f\u3002\u96e3\u6613\u5ea6\u3092\u9078\u3093\u3067\u30b9\u30bf\u30fc\u30c8\uff01</p>
          <div style={styles.diff}>
            {Object.keys(LEVELS).map((l) => (
              <button key={l} style={styles.diffBtn(level === l)} onClick={() => setLevel(l)}>{l}</button>
            ))}
          </div>
          <button style={styles.btn} onClick={start}>\u30b9\u30bf\u30fc\u30c8</button>
        </div>
      </div>
    );
  }

  if (done) {
    const rate = Math.round((score / (TOTAL * 10 + 90)) * 100);
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>\u7d50\u679c\u767a\u8868 \u{1F389}</div>
          <div style={{ textAlign: 'center', fontSize: 48, fontWeight: 700, color: '#4f46e5' }}>{score}<span style={{ fontSize: 18, color: '#6b7280' }}> \u70b9</span></div>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>\u6700\u9ad8\u30b3\u30f3\u30dc: {maxCombo}</p>
          <button style={styles.btn} onClick={start}>\u3082\u3046\u4e00\u56de</button>
          <button style={{ ...styles.btn, background: '#9ca3af' }} onClick={() => setStarted(false)}>\u96e3\u6613\u5ea6\u3092\u9078\u3073\u76f4\u3059</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.bar}>
          <span>\u554f\u984c {qIndex + 1} / {TOTAL}</span>
          <span>\u30b9\u30b3\u30a2: {score}</span>
          <span>\u{1F525} {combo}</span>
        </div>
        <div style={styles.question}>{quiz.a} {quiz.op} {quiz.b} = ?</div>
        <div style={styles.grid}>
          {quiz.opts.map((o, i) => {
            let state = null;
            if (picked !== null) {
              if (o === quiz.ans) state = 'correct';
              else if (o === picked) state = 'wrong';
            }
            return (
              <button key={i} style={styles.opt(state)} onClick={() => pick(o)}>{o}</button>
            );
          })}
        </div>
        {picked !== null && (
          <button style={styles.btn} onClick={next}>{qIndex + 1 >= TOTAL ? '\u7d50\u679c\u3092\u898b\u308b' : '\u6b21\u306e\u554f\u984c'}</button>
        )}
      </div>
    </div>
  );
}