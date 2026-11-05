const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1280,900',
    'http://localhost:5173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  http.get('http://localhost:9222/json', (res) => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', () => {
      const tabs = JSON.parse(raw);
      const tab = tabs.find(t => t.url.includes('5173'));
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      let id = 1;
      function send(method, params = {}) {
        const msgId = id++;
        ws.send(JSON.stringify({ id: msgId, method, params }));
        return msgId;
      }

      ws.onopen = () => {
        send('Runtime.enable');
        setTimeout(() => {
          send('Runtime.evaluate', {
            expression: `
              const shopNavBtn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent.includes('Inköp'));
              if (shopNavBtn) shopNavBtn.click();
            `
          });

          setTimeout(() => {
            send('Runtime.evaluate', {
              expression: `
                (function() {
                  const switcher = document.querySelector('h1 ~ div');
                  const header = document.querySelector('header ~ main > div > div:first-child');
                  const listHeaderRect = header.getBoundingClientRect();
                  const listSwitcherRect = switcher.getBoundingClientRect();

                  // Click Hemmet
                  const hemmetBtn = Array.from(switcher.querySelectorAll('button')).find(b => b.textContent.includes('Hemmet'));
                  if (hemmetBtn) hemmetBtn.click();

                  const pantryHeaderRect = header.getBoundingClientRect();
                  const pantrySwitcherRect = switcher.getBoundingClientRect();

                  return JSON.stringify({
                    listHeaderHeight: listHeaderRect.height,
                    pantryHeaderHeight: pantryHeaderRect.height,
                    listSwitcherY: listSwitcherRect.y,
                    pantrySwitcherY: pantrySwitcherRect.y,
                    deltaY: pantrySwitcherRect.y - listSwitcherRect.y
                  }, null, 2);
                })()
              `,
              returnByValue: true
            });
          }, 600);
        }, 800);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.result && msg.result.result && msg.result.result.value) {
          console.log('--- VERTICAL MEASUREMENT ---');
          console.log(msg.result.result.value);
          chrome.kill();
          process.exit(0);
        }
      };
    });
  });
}

main().catch(console.error);
