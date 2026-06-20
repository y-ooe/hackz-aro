function App() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);

  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  const calculateWinner = (sq) => {
    for (let line of lines) {
      const [a,b,c] = line;
      if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) {
        return { player: sq[a], line };
      }
    }
    return null;
  };

  const winner = calculateWinner(board);
  const isDraw = !winner && board.every(c => c !== null);

  const handleClick = (i) => {
    if (board[i] || winner) return;
    const next = board.slice();
    next[i] = xIsNext ? 'X' : 'O';
    setBoard(next);
    setXIsNext(!xIsNext);
  };

  const reset = () => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
  };

  let status;
  if (winner) {
    status = '勝者: ' + winner.player + ' 🎉';
  } else if (isDraw) {
    status = '引き分け！';
  } else {
    status = '手番: ' + (xIsNext ? 'X' : 'O');
  }

  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'sans-serif',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    padding: '20px'
  };

  const boardStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 90px)',
    gridTemplateRows: 'repeat(3, 90px)',
    gap: '8px',
    marginTop: '20px'
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ margin: 0 }}>まるばつゲーム 🟢❌</h1>
      <div style={{ fontSize: '22px', marginTop: '16px', fontWeight: 'bold' }}>{status}</div>
      <div style={boardStyle}>
        {board.map((cell, i) => {
          const isWin = winner && winner.line.includes(i);
          const cellStyle = {
            width: '90px',
            height: '90px',
            fontSize: '44px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '12px',
            cursor: cell || winner ? 'default' : 'pointer',
            background: isWin ? '#ffe066' : 'rgba(255,255,255,0.9)',
            color: cell === 'X' ? '#e74c3c' : '#2980b9',
            transition: 'background 0.2s'
          };
          return (
            <button key={i} style={cellStyle} onClick={() => handleClick(i)}>
              {cell}
            </button>
          );
        })}
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: '24px',
          padding: '12px 28px',
          fontSize: '16px',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          background: '#fff',
          color: '#764ba2'
        }}
      >
        リセット
      </button>
    </div>
  );
}