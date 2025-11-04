document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('toggle-recognition');
  const inputTextarea = document.getElementById('input'); // 获取聊天框的输入区域
  let recognition;
  let isRecording = false;

  const startRecognition = () => {
    if (!('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别功能。');
      return;
    }

    recognition = new window.SpeechRecognition();
    recognition.lang = 'zh-CN'; // 设置语言
    recognition.interimResults = true; // 获取中间结果
    recognition.continuous = true; // 持续识别，直到用户手动停止

    recognition.onstart = () => {
      isRecording = true;
      toggleButton.textContent = '停止录音'; // 修改按钮文本为“停止录音”
    };

    recognition.onresult = (event) => {
      let finalTranscript = Array.from(event.results)
        .filter(result => result.isFinal)
        .map(result => result[0].transcript)
        .join('');
      if (finalTranscript) {
        inputTextarea.value = originalText + finalTranscript + ' '; // 最终结果：保留原有文本 + 最终结果
      } else {
        inputTextarea.value = originalText + interimTranscript; // 中间结果：原有文本 + 中间结果（临时显示）
      }
    };

    recognition.onerror = (event) => {
      console.error('语音识别错误：', event.error);
    };

    recognition.onend = () => {
      isRecording = false;
      toggleButton.textContent = '开始录音'; // 恢复按钮为原来的图标
    };

    recognition.start();
  };

  const stopRecognition = () => {
    if (recognition) {
      recognition.stop();
    }
  };

  toggleButton.addEventListener('click', () => {
    if (isRecording) {
      stopRecognition();
    } else {
      startRecognition();
    }
  });

  // 监听输入框的回车事件
  inputTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputTextarea.value.trim()); // 调用发送函数
      inputTextarea.value = ''; // 清空输入框
      stopRecognition(); // 停止录音
    }
  });
});
