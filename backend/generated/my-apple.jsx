function App() {
  const OPS = {
    add: { label: '足し算 (+)', sym: '+' },
    sub: { label: '引き算 (-)', sym: '-' },
    mul: { label: '掛け算 (×)', sym: '×' },
  };
  const LEVELS = {
    easy: { label: 'やさしい', max: 10 },
    normal: { label: 'ふつう', max: 30 },
    hard: { label: 'むずかしい', max: 99 },
  };
  const TOTAL = 10;

  const [screen, setScreen] = useState('start');
  const [op, setOp] = useState('add');
  const [level, setLevel] = useState('easy');
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const makeQuestion = (o, lv) => {
    const max = LEVELS[lv].max;
    let a = Math.floor(Math.random() * max) + 1;
    let b = Math.floor(Math.random() * max) + 1;
    if (o === 'sub' && b > a) { const t = a; a = b; b = t; }
    if (o === 'mul') {
      const m = lv === 'easy' ? 9 : lv === 'normal' ? 12 : 20;
      a = Math.floor(Math.random() * m) + 1;
      b = Math.floor(Math.random() * m) + 1;
    }
    const ans = o === 'add' ? a + b : o === 'sub' ? a - b : a * b;
    return { a, b, sym: OPS[o].sym, ans };
  };

  const start = () => {
    const qs = Array.from({ length: TOTAL }, () => makeQuestion(op, level));
    setQuestions(qs);
    setIdx(0);
    setScore(0);
    setInput('');
    setFeedback(null);
    setScreen('quiz');
  };

  const submit = () => {
    if (input === '' || feedback) return;
    const correct = Number(input) === questions[idx].ans;
    if (correct) setScore((s) => s + 1);
    setFeedback({ correct, ans: questions[idx].ans });
  };

  const next = () => {
    if (idx + 1 >= TOTAL) {
      setScreen('result');
    } else {
      setIdx((i) => i + 1);
      setInput('');
      setFeedback(null);
    }
  };

  const wrap = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, sans-serif',
    padding: 20,
    boxSizing: 'border-box',
  };
  const card = {
    background: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    textAlign: 'center',
  };
  const btn = {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 20px',
    fontSize: 16,
    cursor: 'pointer',
    fontWeight: 'bold',
  };
  const selBtn = (active) => ({
    border: active ? '2px solid #6366f1' : '2px solid #ddd',
    background: active ? '#eef2ff' : '#fff',
    color: '#333',
    borderRadius: 12,
    padding: '10px 12px',
    margin: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
  });

  return (
    <div style={wrap}>
      <div style={card}>
        {screen === 'start' && (
          <div>
            <h1 style={{ margin: '0 0 8px', color: '#4338ca' }}>数学クイズ 🧮</h1>
            <p style={{ color: '#666', marginTop: 0 }}>{TOTAL}問に挑戦しよう!</p>
            <div style={{ textAlign: 'left', marginTop: 20 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 6, color: '#444' }}>種類</div>
              <div>
                {Object.keys(OPS).map((k) => (
                  <button key={k} style={selBtn(op === k)} onClick={() => setOp(k)}>
                    {OPS[k].label}
                  </button>
                ))}
              </div>
              <div style={{ fontWeight: 'bold', margin: '16px 0 6px', color: '#444' }}>難易度</div>
              <div>
                {Object.keys(LEVELS).map((k) => (
                  <button key={k} style={selBtn(level === k)} onClick={() => setLevel(k)}>
                    {LEVELS[k].label}
                  </button>
                ))}
              </div>
            </div>
            <button style={{ ...btn, marginTop: 24, width: '100%' }} onClick={start}>
              スタート
            </button>
          </div>
        )}

        {screen === 'quiz' && questions[idx] && (
          <div>
            <div style={{ color: '#888', fontWeight: 'bold' }}>
              第 {idx + 1} / {TOTAL} 問　スコア: {score}
            </div>
            <div style={{ height: 8, background: '#eee', borderRadius: 4, margin: '12px 0', overflow: 'hidden' }}>
              <div style={{ width: `${(idx / TOTAL) * 100}%`, height: '100%', background: '#6366f1', transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 40, fontWeight: 'bold', margin: '24px 0', color: '#333' }}>
              {questions[idx].a} {questions[idx].sym} {questions[idx].b} = ?
            </div>
            <input
              type="number"
              value={input}
              disabled={!!feedback}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
              style={{
                fontSize: 24,
                textAlign: 'center',
                padding: '10px',
                width: 140,
                borderRadius: 12,
                border: '2px solid #ccc',
              }}
            />
            {feedback && (
              <div style={{ marginTop: 16, fontSize: 18, fontWeight: 'bold', color: feedback.correct ? '#16a34a' : '#dc2626' }}>
                {feedback.correct ? '正解! 🎉' : `不正解… 正解は ${feedback.ans}`}
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              {!feedback ? (
                <button style={{ ...btn, width: '100%' }} onClick={submit}>
                  回答する
                </button>
              ) : (
                <button style={{ ...btn, width: '100%' }} onClick={next}>
                  {idx + 1 >= TOTAL ? '結果を見る' : '次の問題へ'}
                </button>
              )}
            </div>
          </div>
        )}

        {screen === 'result' && (
          <div>
            <h1 style={{ color: '#4338ca' }}>結果発表 🏆</h1>
            <div style={{ fontSize: 48, fontWeight: 'bold', margin: '16px 0', color: '#6366f1' }}>
              {score} / {TOTAL}
            </div>
            <p style={{ color: '#666', fontSize: 18 }}>
              {score === TOTAL ? '全問正解! すごい! 🌟' : score >= TOTAL * 0.6 ? 'よくできました! 👍' : 'もう一回挑戦してみよう! 💪'}
            </p>
            <button style={{ ...btn, marginTop: 16, width: '100%' }} onClick={() => setScreen('start')}>
              もう一度遊ぶ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}