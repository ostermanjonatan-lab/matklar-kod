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
              // Click Inköp
              const shopNavBtn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent.includes('Inköp'));
              if (shopNavBtn) shopNavBtn.click();
            `
          });

          setTimeout(() => {
            send('Runtime.evaluate', {
              expression: `
                (function() {
                  const header = document.querySelector('header ~ main > div > div:first-child');
                  const switcher = document.querySelector('h1 ~ div');
                  
                  function getDetails() {
                    const switcher = document.querySelector('h1 ~ div');
                    const header = document.querySelector('header ~ main > div > div:first-child');
                    const h1 = document.querySelector('h1');
                    const row = switcher ? switcher.closest('.flex.items-center.justify-between') : null;
                    return {
                      headerRect: header ? header.getBoundingClientRect() : null,
                      switcherRect: switcher ? switcher.getBoundingClientRect() : null,
                      h1Rect: h1 ? h1.getBoundingClientRect() : null,
                      rowRect: row ? row.getBoundingClientRect() : null,
                      h1Text: h1 ? h1.textContent : '',
                    };
                  }

                  const step1 = getDetails();

                  // Click Hemmet
                  const hemmetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hemmet'));
                  if (hemmetBtn) hemmetBtn.click();

                  return new Promise(resolve => {
                    setTimeout(() => {
                      const step2 = getDetails();

                      // Click Inköpslista back
                      const listBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Inköpslista') && b.closest('.bg-\\[\\#F0ECE1\\]'));
                      if (listBtn) listBtn.click();

                      setTimeout(() => {
                        const step3 = getDetails();

                        resolve(JSON.stringify({
                          step1_list: { x: step1.switcherRect.x, y: step1.switcherRect.y, h: step1.headerRect.height },
                          step2_hemmet: { x: step2.switcherRect.x, y: step2.switcherRect.y, h: step2.headerRect.height },
                          step3_listAgain: { x: step3.switcherRect.x, y: step3.switcherRect.y, h: step3.headerRect.height },
                          diff_1_to_2: { dx: step2.switcherRect.x - step1.switcherRect.x, dy: step2.switcherRect.y - step1.switcherRect.y, dh: step2.headerRect.height - step1.headerRect.height },
                          diff_2_to_3: { dx: step3.switcherRect.x - step2.switcherRect.x, dy: step3.switcherRect.y - step2.switcherRect.y, dh: step3.headerRect.height - step2.headerRect.height }
                        }, null, 2));
                      }, 300);
                    }, 300);
                  });
                })()
              `,
              returnByValue: true,
              awaitPromise: true
            });
          }, 600);
        }, 800);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.result && msg.result.result && msg.result.result.value) {
          console.log('--- TEST RESULT ---');
          console.log(msg.result.result.value);
          chrome.kill();
          process.exit(0);
        }
      };
    });
  });
}

main().catch(console.error);
