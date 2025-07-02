import React, { useState } from 'react';

const DocsFormatter = () => {
  const [docUrl, setDocUrl] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [sheetId, setSheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A2:A');
  const [batchOutput, setBatchOutput] = useState<string[]>([]);

  const extractDocId = (url: string): string | null => {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] || null;
  };

  // const handleFetchDoc = async () => {
  //   setError('');
  //   setOutput('');
  //   setLoading(true);

  //   const docId = extractDocId(docUrl);
  //   if (!docId) {
  //     setError('Invalid Google Docs URL');
  //     setLoading(false);
  //     return;
  //   }

  //   try {
  //     const response = await fetch('http://localhost:8028/format-doc', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ documentId: docId }),
  //     });

  //     const data = await response.json();
  //     setOutput(data.text || '');
  //   } catch (err: any) {
  //     setError(err.message || 'Unexpected error');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

const handleFetchFromSheet = async () => {
  setError('');
  setBatchOutput([]);
  setLoading(true);

  try {
    const sheetRes = await fetch('http://localhost:8028/get-doc-urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId: sheetId, range }),
    });

    const { urls } = await sheetRes.json();

    const results: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!extractDocId(url)) continue;

      const response = await fetch('http://localhost:8028/format-and-store-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheetId,
          rowIndex: i + 1, // Adjust for 1-based index
          originalUrl: url,
        }),
      });

      const { newDocUrl, text } = await response.json();
      results.push(text || `Created: ${newDocUrl}`);

    }

    setBatchOutput(results);
  } catch (err: any) {
    setError(err.message || 'Error formatting documents from sheet');
  } finally {
    setLoading(false);
  }
};


  const formatOutputToHtml = (text: string) => {
    const lines = text.split('\n');
    let currentLabel: 'why' | 'action' | 'qa' | null = null;
    let listItems: JSX.Element[] = [];
    const flushList = () => {
      if (!listItems.length) return null;
      const list = <ul style={{ marginLeft: '2rem' }}>{listItems}</ul>;
      listItems = [];
      return list;
    };

    const elements: JSX.Element[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (['**Why:**', '**Action:**', '**QA:**'].includes(trimmed)) {
        const flushed = flushList();
        if (flushed) elements.push(flushed);
        currentLabel = trimmed.includes('Why') ? 'why' : trimmed.includes('Action') ? 'action' : 'qa';
        elements.push(
          <strong key={`label-${index}`} style={{ display: 'block', marginTop: '1rem', marginLeft: '1rem' }}>
            {trimmed.replace(/\*\*/g, '')}
          </strong>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        const flushed = flushList();
        if (flushed) elements.push(flushed);
        currentLabel = null;
        elements.push(
          <h3 key={`header-${index}`} style={{ marginTop: '1.5rem' }}>
            {trimmed.replace(/^###\s*/, '')}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('- ')) {
        listItems.push(<li key={`li-${index}`}>{trimmed.slice(2)}</li>);
        return;
      }

      const flushed = flushList();
      if (flushed) elements.push(flushed);
      elements.push(
        <p key={`p-${index}`} style={{ marginLeft: '0.5rem' }}>
          {trimmed}
        </p>
      );
    });

    const lastFlush = flushList();
    if (lastFlush) elements.push(lastFlush);
    return elements;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: 'auto' }}>
      <h2>Google Docs Formatter</h2>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Google Sheet ID"
          value={sheetId}
          onChange={(e) => setSheetId(e.target.value)}
          style={{ width: '60%', marginRight: '1rem', padding: '8px' }}
        />
        <input
          type="text"
          placeholder="Range (e.g., Sheet1!A2:A)"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ width: '30%', padding: '8px' }}
        />
        <button onClick={handleFetchFromSheet} disabled={loading} style={{ marginTop: '10px' }}>
          {loading ? 'Loading...' : 'Format All from Sheet'}
        </button>
      </div>

      {/* <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Paste Google Doc URL"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          style={{ flex: 1, padding: '8px' }}
        />
        <button onClick={handleFetchDoc} disabled={loading}>
          {loading ? 'Formatting...' : 'Format'}
        </button>
      </div> */}

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {output && (
        <div style={{ background: '#f9f9f9', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', color: '#000000'  }}>
          <h3>Formatted Output</h3>
          {formatOutputToHtml(output)}
        </div>
      )}

      {batchOutput.length > 0 && (
        <div>
          <h3>Batch Results</h3>
          {batchOutput.map((text, idx) => (
            <div key={idx} style={{ marginBottom: '2rem', padding: '1rem', background: '#f0f0f0', color: '#000000' }}>
              <h4>Document {idx + 1}</h4>
              {formatOutputToHtml(text)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocsFormatter;
