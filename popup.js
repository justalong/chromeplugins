document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const domainInput = document.getElementById('domainInput');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  const fetchButton = document.getElementById('fetchData');
  const responseElement = document.getElementById('response');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // 设置默认日期为上个月的完整月份
  const today = new Date();
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1); // 上个月1号
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0); // 上个月最后一天
  
  fromDateInput.value = lastMonthStart.toISOString().split('T')[0];
  toDateInput.value = lastMonthEnd.toISOString().split('T')[0];

  // 标签切换功能
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      
      // 更新按钮状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // 更新内容显示
      tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== `${tabId}-tab`);
      });
    });
  });

  // 从URL中提取域名
  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      return url.replace('www.', '');
    }
  }

  // 格式化日期
  function formatDate(date) {
    return `${date.getFullYear()}|${String(date.getMonth() + 1).padStart(2, '0')}|${String(date.getDate()).padStart(2, '0')}`;
  }

  // 获取所有cookie
  async function getAllCookies() {
    try {
      const cookies = await chrome.cookies.getAll({
        domain: 'pro.similarweb.com'
      });
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      console.log('获取到的Cookies:', cookies);
      return cookieString;
    } catch (error) {
      console.error('Error getting cookies:', error);
      throw new Error('Failed to get cookies. Please make sure you are logged in to SimilarWeb Pro.');
    }
  }

  // 获取单个域名的数据
  async function fetchDomainData(domain, fromDate, toDate) {
    const fromStr = formatDate(fromDate);
    const toStr = formatDate(toDate);
    const cookies = await getAllCookies();

    const url = `https://pro.similarweb.com/api/WebsiteOverview/getheader?mainDomainOnly=false&includeCrossData=true&key=${domain}&isWWW=false&country=999&to=${toStr}&from=${fromStr}&isWindow=false&webSource=Total&ignoreFilterConsistency=false`;

    // 生成随机的页面视图ID
    const pageViewId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    console.log('请求URL:', url);
    console.log('请求头:', {
      'accept': 'application/json',
      'accept-language': 'zh-CN,zh;q=0.9',
      'cache-control': 'no-cache',
      'content-type': 'application/json; charset=utf-8',
      'cookie': cookies,
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
      'x-sw-page': `https://pro.similarweb.com/#/digitalsuite/websiteanalysis/overview/website-performance/*/999/28d?webSource=Total&key=${domain}`,
      'x-sw-page-view-id': pageViewId
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'no-cache',
        'content-type': 'application/json; charset=utf-8',
        'cookie': cookies,
        'sec-fetch-site': 'same-origin',
        'x-requested-with': 'XMLHttpRequest',
        'x-sw-page': `https://pro.similarweb.com/#/digitalsuite/websiteanalysis/overview/website-performance/*/999/28d?webSource=Total&key=${domain}`,
        'x-sw-page-view-id': pageViewId
      }
    });

    if (!response.ok) {
      console.error('请求失败:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('响应数据:', data);
    return data;
  }

  // 格式化访问量
  function formatVisits(visits) {
    if (visits === 0) return '0';
    if (visits === '') return '—';
    
    const units = ['千', '万', '亿'];
    const bases = [1000, 10000, 100000000];
    
    let value = visits;
    let unitIndex = -1;
    
    // 找到合适的单位
    for (let i = bases.length - 1; i >= 0; i--) {
      if (value >= bases[i]) {
        value = value / bases[i];
        unitIndex = i;
        break;
      }
    }
    
    // 保留一位小数
    value = Math.round(value * 10) / 10;
    
    // 如果数值小于1000，直接返回数字
    if (unitIndex === -1) {
      return value.toString();
    }
    
    return `${value}${units[unitIndex]}`;
  }

  // 生成指定范围内的随机数
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 控制并发请求的函数
  async function processWithConcurrency(items, processFn) {
    const results = [];
    let currentIndex = 0;
    
    while (currentIndex < items.length) {
      // 随机生成本次处理的并发数（3-7）
      const currentConcurrency = getRandomInt(3, 7);
      // 获取当前批次的items
      const currentChunk = items.slice(currentIndex, currentIndex + currentConcurrency);
      
      console.log(`开始处理新的一组请求，并发数: ${currentChunk.length}`);
      const chunkResults = await Promise.all(currentChunk.map(processFn));
      results.push(...chunkResults);
      
      // 更新索引
      currentIndex += currentConcurrency;
      
      // 如果还有剩余项，则随机延迟6-20秒
      if (currentIndex < items.length) {
        const delaySeconds = getRandomInt(6, 20);
        console.log(`等待${delaySeconds}秒后处理下一组请求...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }
    
    return results;
  }

  // 处理输入并获取数据
  fetchButton.addEventListener('click', async () => {
    const input = domainInput.value.trim();
    if (!input) {
      alert('Please enter domain(s)');
      return;
    }

    try {
      console.log('开始处理输入:', input);
      const fromDate = new Date(fromDateInput.value);
      const toDate = new Date(toDateInput.value);
      console.log('日期范围:', { from: fromDate, to: toDate });
      
      let results = {};
      let domains = [];

      // 解析输入
      try {
        // 尝试解析为JSON
        const jsonInput = JSON.parse(input);
        console.log('解析后的JSON输入:', jsonInput);
        
        if (Array.isArray(jsonInput)) {
          // 如果是数组，直接使用
          domains = jsonInput.map(domain => extractDomain(domain));
          console.log('解析为域名数组:', domains);
          results = [];
        } else {
          // 如果是特殊格式，提取所有link
          const extractedDomains = [];
          function extractDomainsFromObject(obj) {
            for (const value of Object.values(obj)) {
              if (value.link) {
                extractedDomains.push(extractDomain(value.link));
              } else if (typeof value === 'object') {
                extractDomainsFromObject(value);
              }
            }
          }
          extractDomainsFromObject(jsonInput);
          domains = extractedDomains;
          results = jsonInput; // 保持原始结构
          console.log('从特殊格式中提取的域名:', domains);
        }
      } catch (e) {
        // 如果不是JSON，则作为单个域名处理
        domains = [extractDomain(input)];
        results = '';
        console.log('作为单个域名处理:', domains);
      }

      console.log('开始处理域名列表:', domains);

      // 使用并发控制获取数据
      const responses = await processWithConcurrency(
        domains,
        async (domain) => {
          try {
            const data = await fetchDomainData(domain, fromDate, toDate);
            console.log(`域名 ${domain} 的数据获取成功:`, data);
            return { domain, data };
          } catch (error) {
            console.error(`域名 ${domain} 的数据获取失败:`, error);
            return { domain, error: error.message };
          }
        }
      );

      console.log('所有请求完成，响应结果:', responses);

      // 处理结果
      if (Array.isArray(results)) {
        // 如果是数组输入，返回数组结果
        results = responses.map(({ domain, data, error }) => {
          if (error) {
            return { domain, error };
          }
          const itemData = Object.values(data)[0] || {};
          return {
            domain,
            data: itemData,
            monthlyVisits: formatVisits(itemData.monthlyVisits)
          };
        });
      } else if (typeof results === 'object') {
        // 如果是特殊格式，将结果添加到原始结构中
        function addResultsToObject(obj) {
          for (const [key, value] of Object.entries(obj)) {
            if (value.link) {
              const domain = extractDomain(value.link);
              const response = responses.find(r => r.domain === domain);
              if (response && !response.error) {
                const itemData = Object.values(response.data)[0] || {};
                obj[key] = {
                  ...value,
                  monthlyVisits: formatVisits(itemData.monthlyVisits)
                };
              } else if (response?.error) {
                obj[key] = {
                  ...value,
                  error: response.error
                };
              }
            } else if (typeof value === 'object') {
              addResultsToObject(value);
            }
          }
        }
        addResultsToObject(results);
      } else {
        // 如果是单个域名，直接返回结果
        const response = responses[0];
        if (response.error) {
          results = { error: response.error };
        } else {
          const itemData = Object.values(response.data)[0] || {};
          results = {
            domain: domains[0],
            data: itemData,
            monthlyVisits: formatVisits(itemData.monthlyVisits)
          };
        }
      }

      console.log('最终处理结果:', results);
      responseElement.textContent = JSON.stringify(results, null, 2);
    } catch (error) {
      console.error('处理过程中发生错误:', error);
      responseElement.textContent = `Error: ${error.message}`;
    }
  });
}); 