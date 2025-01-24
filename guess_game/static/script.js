/********************************
 * 全局變數 & 初始化
 ********************************/

let map = null;                // Google Map物件
let marker = null;             // 玩家在地圖上點擊的 Marker
let actualMarker = null;       // 正確位置 (綠色標記)
let hasGuessed = false;        // 是否已經猜過
let autoNextInterval = null;   // 計時器ID (控制 10秒後自動下一題)
function setupCountdownClickHandler() {
  const countdownElement = document.getElementById('countdown');
  countdownElement.addEventListener('click', function() {
      // 立即結束倒計時並跳轉
      if (autoNextInterval) {
          clearInterval(autoNextInterval);
          autoNextInterval = null;
      }
      countdownElement.textContent = '自動跳轉 0 秒';
      countdownElement.style.transform = 'scale(1.1)';
      setTimeout(() => {
          countdownElement.style.transform = 'scale(1)';
          countdownElement.style.display = 'none';
          nextQuestion(); // 跳轉到下一題
      }, 200);
  });
}

// 在頁面加載完成後執行
window.onload = function() {
  // ... 其他初始化代碼 ...
  setupCountdownClickHandler();
};
// 頁面載入後立即執行
window.onload = function() {
  // 先取得第一支隨機影片
  fetchRandomVideo();
  // 預設隱藏「下一題」按鈕
  document.getElementById('next-question').style.display = 'none';
  // 預設清空倒數文字
  document.getElementById('countdown').textContent = '';
  document.getElementById('countdown').style.display = 'none';
};


/********************************
 * Google Map初始化
 ********************************/
window.initMap = function() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 23.97, lng: 120.97 }, // 台灣中心點
    zoom: 7
  });

  // 點擊地圖，放置玩家猜測的Marker
  map.addListener('click', function(e) {
    placeMarker(e.latLng);
  });
};

// 在地圖上放置(或更新)玩家Marker
function placeMarker(latLng) {
  if (marker) {
    marker.setPosition(latLng);
  } else {
    marker = new google.maps.Marker({
      position: latLng,
      map: map
    });
  }
  // 將經緯度同步到表單欄位
  document.getElementById('lat').value = latLng.lat();
  document.getElementById('lng').value = latLng.lng();
}


/********************************
 * 取得隨機影片
 ********************************/
async function fetchRandomVideo() {
  try {
    const response = await fetch("/random_video");
    if (response.ok) {
      const data = await response.json();
      // 指定影片來源
      document.getElementById("video-player").src = data.video_url;

      // 若有標題需求，可做：
      // document.getElementById("video-title").innerText = data.title;

      // 記錄正確解答位置
      window.currentLat = data.lat; 
      window.currentLng = data.lng;

      // 重置猜測狀態
      hasGuessed = false;

      // 重置地圖與標記
      if (marker) {
        marker.setMap(null);
      }
      marker = null;

      if (actualMarker) {
        actualMarker.setMap(null);
      }
      actualMarker = null;

      map.setCenter({ lat: 23.97, lng: 120.97 });
      map.setZoom(7);

      // 隱藏可能顯示中的結果&地圖 Overlay
      document.getElementById('result-overlay').style.display = 'none';
      document.getElementById('map-overlay').style.display = 'none';

    } else {
      document.getElementById("result").innerHTML = "<p>No videos available!</p>";
    }
  } catch (error) {
    console.error('Error in fetchRandomVideo:', error);
  }
}


/********************************
 * 地圖 Overlay 開關
 ********************************/
document.getElementById("open-map").addEventListener("click", function() {
  document.getElementById("map-overlay").style.display = "block";
  // 重新觸發地圖resize, 以免顯示錯誤
  google.maps.event.trigger(map, 'resize');
});

document.getElementById("close-map").addEventListener("click", function() {
  document.getElementById("map-overlay").style.display = "none";
  // 重置焦點到打開地圖按鈕
  document.getElementById("open-map").focus();
});


function startCountdown() {
  let countdown = 10;
  const countdownElement = document.getElementById('countdown');
  
  countdownElement.removeEventListener('click', countdownElement.clickHandler);
  countdownElement.clickHandler = function() {
      if (autoNextInterval) {
          clearInterval(autoNextInterval);
          autoNextInterval = null;
      }
      countdownElement.textContent = '自動跳轉 0 秒';
      countdownElement.style.transform = 'scale(1.1)';
      setTimeout(() => {
          countdownElement.style.transform = 'scale(1)';
          countdownElement.style.display = 'none';
          nextQuestion(); // 跳轉到下一題
      }, 200);
  };
  countdownElement.addEventListener('click', countdownElement.clickHandler);

  if (autoNextInterval) {
      clearInterval(autoNextInterval);
  }

  function updateCountdown() {
    if (countdown > 0) {
        countdownElement.style.display = 'block';  // 显示倒计时元素
        countdownElement.textContent = `自動跳轉倒數 ${countdown} 秒`;
        countdownElement.style.transform = 'scale(1.1)';  // 稍微放大
        setTimeout(() => {
            countdownElement.style.transform = 'scale(1)';  // 恢复原始大小
        }, 200);
        countdown--;
    } else {
        clearInterval(autoNextInterval);
        autoNextInterval = null;
        countdownElement.style.display = 'none';  // 隐藏倒计时元素
        nextQuestion(); // 自动跳到下一题
    }
  }

  // 立即更新一次，然后每秒更新
  updateCountdown();
  autoNextInterval = setInterval(updateCountdown, 1000);
}


/********************************
 * 提交猜測 (guess-form)
 ********************************/
document.getElementById("guess-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  // 若已經猜過一次
  if (hasGuessed) {
    alert('您已經猜過了，請點擊 "下一題" 或等待自動跳轉。');
    return;
  }

  // 讀取表單座標
  const guessedLat = parseFloat(document.getElementById("lat").value);
  const guessedLng = parseFloat(document.getElementById("lng").value);

  // 正解位置
  const actualLat = window.currentLat;
  const actualLng = window.currentLng;

  // 計算距離 (Haversine)
  const R = 6371;
  const dLat = (actualLat - guessedLat) * Math.PI / 180;
  const dLon = (actualLng - guessedLng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(guessedLat * Math.PI / 180) * Math.cos(actualLat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // 放置正確答案Marker (綠色)
  if (actualMarker) {
    actualMarker.setMap(null);
  }
  actualMarker = new google.maps.Marker({
    position: { lat: actualLat, lng: actualLng },
    map: map,
    icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
  });

  // 顯示結果覆蓋層
  const resultOverlay = document.getElementById("result-overlay");
  const distanceResult = document.getElementById("distance-result");

  if (distance < 10) {
    distanceResult.style.color = "#28a745"; // 綠色
    distanceResult.textContent = `太棒了！距離實際位置只有 ${distance.toFixed(2)} 公里。`;
  } else {
    distanceResult.style.color = "#dc3545"; // 紅色
    distanceResult.textContent = `加油！你的猜測距離實際位置有 ${distance.toFixed(2)} 公里。`;
  }

  resultOverlay.style.display = "flex";

  // 點擊overlay任意位置關閉
  resultOverlay.onclick = function() {
    resultOverlay.style.display = "none";
  };

  // 顯示 "下一題" 按鈕
  document.getElementById('next-question').style.display = 'block';

  // 標記為已猜過
  hasGuessed = true;

  const countdownElement = document.getElementById('countdown');
  countdownElement.style.display = 'block';

  // 開始 10 秒倒數
  startCountdown();
});


/********************************
 * 下一題 (按鈕事件 & 函式)
 ********************************/
document.getElementById('next-question').addEventListener('click', nextQuestion);

function nextQuestion() {
  // 隱藏結果 overlay
  document.getElementById('result-overlay').style.display = 'none';

  // 清除計時器
  if (autoNextInterval) {
    clearInterval(autoNextInterval);
    autoNextInterval = null;
  }

  // 清除舊 Marker
  if (marker) {
    marker.setMap(null);
    marker = null;
  }
  if (actualMarker) {
    actualMarker.setMap(null);
    actualMarker = null;
  }

  // 重置表單
  document.getElementById('lat').value = '';
  document.getElementById('lng').value = '';

  // 重置地圖位置
  map.setCenter({ lat: 23.97, lng: 120.97 });
  map.setZoom(7);

  // 關閉地圖overlay (若剛好打開著)
  document.getElementById('map-overlay').style.display = 'none';

  // 隱藏"下一題"按鈕
  document.getElementById('next-question').style.display = 'none';
  
  // 清空倒數
  document.getElementById('countdown').textContent = '';

  // 重新抓取新影片 (新題目)
  fetchRandomVideo();
}
