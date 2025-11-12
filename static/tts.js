class TextToSpeech {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.utterance = null;
        this.isSpeaking = false;
        this.isPaused = false;
        this.availableVoices = [];
        this.currentVoice = null;
        this.onSpeakingStart = null;
        this.onSpeakingEnd = null;
    }

    async init() {
        await this.loadVoices();
        this.setupEventListeners();
        console.log('TTS initialized with', this.availableVoices.length, 'voices');
    }

    loadVoices() {
        return new Promise((resolve) => {
            const checkVoices = () => {
                const voices = this.synthesis.getVoices();
                if (voices.length > 0) {
                    this.availableVoices = voices;
                    this.selectBestVoice();
                    resolve();
                }
            };

            // 立即检查一次
            checkVoices();
            
            // 监听语音变化
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = checkVoices;
            }
            
            // 超时处理
            setTimeout(() => {
                if (this.availableVoices.length === 0) {
                    console.warn('No voices loaded, using default');
                    resolve();
                }
            }, 3000);
        });
    }

    selectBestVoice() {
        // 优先选择英语语音
        const englishVoices = this.availableVoices.filter(voice => 
            voice.lang.startsWith('en') && voice.localService === false
        );
        
        if (englishVoices.length > 0) {
            // 优先选择美式英语女性语音
            const preferredVoice = englishVoices.find(voice => 
                (voice.lang.includes('US') || voice.name.includes('US')) &&
                voice.name.toLowerCase().includes('female')
            ) || englishVoices.find(voice => 
                voice.lang.includes('US') || voice.name.includes('US')
            ) || englishVoices[0];
            
            this.currentVoice = preferredVoice;
        } else if (this.availableVoices.length > 0) {
            // 如果没有英语语音，使用第一个可用语音
            this.currentVoice = this.availableVoices[0];
        }
        
        console.log('Selected voice:', this.currentVoice?.name);
    }

    setupEventListeners() {
        this.synthesis.addEventListener('voiceschanged', () => {
            this.loadVoices();
        });
    }

    speak(text, rate = 1.0, pitch = 1.0, volume = 1.0) {
        return new Promise((resolve, reject) => {
            if (this.isSpeaking) {
                this.stop();
            }

            // 清理文本，移除反馈标记
            const cleanText = text.replace(/🎯.*?📝.*?(?=\.|$)/g, '').trim();
            if (!cleanText) {
                resolve();
                return;
            }

            this.utterance = new SpeechSynthesisUtterance(cleanText);
            
            // 设置语音参数
            if (this.currentVoice) {
                this.utterance.voice = this.currentVoice;
            }
            
            this.utterance.rate = Math.max(0.5, Math.min(2, rate)); // 限制范围
            this.utterance.pitch = Math.max(0.5, Math.min(2, pitch));
            this.utterance.volume = Math.max(0, Math.min(1, volume));
            this.utterance.lang = 'en-US';

            // 事件监听
            this.utterance.onstart = () => {
                this.isSpeaking = true;
                this.isPaused = false;
                console.log('TTS: 开始播放:', cleanText.substring(0, 50) + '...');
                if (this.onSpeakingStart) this.onSpeakingStart();
            };

            this.utterance.onend = () => {
                this.isSpeaking = false;
                this.isPaused = false;
                console.log('TTS: 播放完成');
                if (this.onSpeakingEnd) this.onSpeakingEnd();
                resolve();
            };

            this.utterance.onerror = (event) => {
                console.error('TTS 错误:', event);
                this.isSpeaking = false;
                this.isPaused = false;
                if (this.onSpeakingEnd) this.onSpeakingEnd();
                reject(new Error('语音播放失败: ' + event.error));
            };

            this.utterance.onpause = () => {
                this.isPaused = true;
                console.log('TTS: 已暂停');
            };

            this.utterance.onresume = () => {
                this.isPaused = false;
                console.log('TTS: 继续播放');
            };

            // 开始播放
            try {
                this.synthesis.speak(this.utterance);
            } catch (error) {
                console.error('TTS speak error:', error);
                reject(error);
            }
        });
    }

    stop() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.isPaused = false;
            console.log('TTS: 已停止');
        }
    }

    pause() {
        if (this.synthesis.speaking && !this.isPaused) {
            this.synthesis.pause();
            this.isPaused = true;
        }
    }

    resume() {
        if (this.synthesis.speaking && this.isPaused) {
            this.synthesis.resume();
            this.isPaused = false;
        }
    }

    setVoice(voiceName) {
        const voice = this.availableVoices.find(v => v.name === voiceName);
        if (voice) {
            this.currentVoice = voice;
            console.log('TTS voice changed to:', voiceName);
        }
    }

    setRate(rate) {
        if (this.utterance && this.isSpeaking) {
            this.utterance.rate = rate;
        }
    }

    setPitch(pitch) {
        if (this.utterance && this.isSpeaking) {
            this.utterance.pitch = pitch;
        }
    }

    setVolume(volume) {
        if (this.utterance && this.isSpeaking) {
            this.utterance.volume = volume;
        }
    }

    getVoices() {
        return this.availableVoices;
    }

    getAvailableEnglishVoices() {
        return this.availableVoices.filter(voice => 
            voice.lang.startsWith('en')
        );
    }

    getStatus() {
        return {
            isSpeaking: this.isSpeaking,
            isPaused: this.isPaused,
            currentVoice: this.currentVoice ? this.currentVoice.name : null,
            availableVoices: this.availableVoices.length
        };
    }

    // 设置回调函数
    onStart(callback) {
        this.onSpeakingStart = callback;
    }

    onEnd(callback) {
        this.onSpeakingEnd = callback;
    }

    // 测试语音功能
    async testVoice() {
        const testText = "Hello! This is a test of the text to speech functionality.";
        try {
            await this.speak(testText);
            console.log('TTS test completed successfully');
            return true;
        } catch (error) {
            console.error('TTS test failed:', error);
            return false;
        }
    }
}

// 创建全局TTS实例
const tts = new TextToSpeech();

// 导出供其他模块使用
window.tts = tts;

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    tts.init().then(() => {
        console.log('TTS system ready');
    }).catch(error => {
        console.error('TTS initialization failed:', error);
    });
});