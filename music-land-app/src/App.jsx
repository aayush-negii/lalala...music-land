import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

// Helper to create SVG icons.
const Icon = ({ name, size = 24 }) => {
  const icons = {
    search: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    play: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>,
    pause: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>,
    next: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>,
    previous: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>,
    lyrics: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>,
    volume: <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon></svg>,
  };
  return icons[name] || null;
};

// Helper function to format time
const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

// --- Components ---

const SearchBar = ({ onSearch }) => {
  const [term, setTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (term.trim() === '') {
      setSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      try {
        const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5`;
        const response = await axios.get(apiUrl);
        setSuggestions(response.data.results);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      }
    };
    const debounceTimeout = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimeout);
  }, [term]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (term.trim()) {
      onSearch(term);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestionTerm) => {
    setTerm(suggestionTerm);
    onSearch(suggestionTerm);
    setSuggestions([]);
  };

  return (
    <form onSubmit={handleSearch} className="search-bar-form">
      <div className="search-icon"><Icon name="search" size={20} /></div>
      <input type="text" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="What do you want to play?" className="search-input" autoComplete="off" />
      {suggestions.length > 0 && (
        <div className="search-suggestions">
          {suggestions.map((song) => (
            <div key={song.trackId} className="suggestion-item" onClick={() => handleSuggestionClick(song.trackName)}>
              {song.trackName} - {song.artistName}
            </div>
          ))}
        </div>
      )}
    </form>
  );
};

const ProgressBar = ({ currentTime, duration, onSeek }) => {
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const progressBarRef = useRef(null);
    const handleSeek = (e) => {
        const progressBar = progressBarRef.current;
        if (!progressBar || duration === 0) return;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        onSeek(percentage * duration);
    };
    return (
        <div>
            <div className="progress-bar-container" ref={progressBarRef} onClick={handleSeek}>
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="time-stamps">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>
        </div>
    );
};

const LyricsModal = ({ lyrics, onClose, isLoading }) => (
    <div className="lyrics-modal-overlay" onClick={onClose}>
        <div className="lyrics-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Lyrics</h2>
            {isLoading ? <p>Loading lyrics...</p> : <pre>{lyrics || 'No lyrics found for this song.'}</pre>}
        </div>
    </div>
);

// --- Main App Component ---

export default function App() {
  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [trackProgress, setTrackProgress] = useState({ currentTime: 0, duration: 0 });
  const [volume, setVolume] = useState(0.75);
  const [lyrics, setLyrics] = useState('');
  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  const audioRef = useRef(null);
  
  const currentSong = songs[currentIndex];

  const fetchSongs = async (term) => {
    setIsLoading(true);
    try {
      const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=20`;
      const response = await axios.get(apiUrl);
      setSongs(response.data.results);
      setCurrentIndex(0);
      setIsPlaying(false);
    } catch (error) {
      console.error(`Error fetching songs for term ${term}:`, error);
      setSongs([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSongs('lofi');
  }, []);

  const handleNextSong = useCallback(async () => {
    if (songs.length === 0) return;
    if (currentIndex < songs.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsPlaying(true);
        return;
    }
    try {
        const artistName = songs[currentIndex].artistName;
        const apiUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=20`;
        const response = await axios.get(apiUrl);
        const existingTrackIds = new Set(songs.map(s => s.trackId));
        const newSong = response.data.results.find(result => !existingTrackIds.has(result.trackId));
        if (newSong) {
            setSongs(prevSongs => [...prevSongs, newSong]);
            setCurrentIndex(songs.length);
            setIsPlaying(true);
        } else {
            setCurrentIndex(0);
            setIsPlaying(true);
        }
    } catch (error) {
        console.error("Error fetching similar songs:", error);
        setCurrentIndex(0);
        setIsPlaying(true);
    }
  }, [currentIndex, songs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    const updateProgress = () => setTrackProgress({ currentTime: audio.currentTime, duration: audio.duration || 0 });
    const handleSongEnd = () => handleNextSong();
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleSongEnd);
    audio.addEventListener('loadedmetadata', updateProgress);

    if (isPlaying) {
      audio.play().catch(error => { if (error.name !== 'AbortError') console.error("Audio play failed:", error); });
    } else {
      audio.pause();
    }

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleSongEnd);
      audio.removeEventListener('loadedmetadata', updateProgress);
    };
  }, [isPlaying, currentSong, handleNextSong, volume]);

  const handlePlayPause = () => currentSong && setIsPlaying(!isPlaying);
  
  const handlePrevSong = () => {
    if (songs.length === 0) return;
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    setCurrentIndex(prevIndex);
    setIsPlaying(true);
  };

  const handleSeek = (seekTime) => {
    if (audioRef.current) audioRef.current.currentTime = seekTime;
  };

  const handleVolumeChange = (e) => setVolume(parseFloat(e.target.value));

  const handleLyricsClick = async () => {
    if (!currentSong) return;
    setIsLyricsModalOpen(true);
    setIsLyricsLoading(true);
    try {
        const { artistName, trackName } = currentSong;
        const apiUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
        const response = await axios.get(apiUrl);
        setLyrics(response.data.lyrics);
    } catch (error) {
        console.error("Error fetching lyrics:", error);
        setLyrics('Sorry, no lyrics could be found for this song.');
    }
    setIsLyricsLoading(false);
  };

  return (
    <div className="app-container">
      <h1 className="app-title">lalalala...MUSIC LAND</h1>
      <SearchBar onSearch={fetchSongs} />

      {isLoading ? <p>Loading...</p> : currentSong ? (
        <div className="main-player-tile">
          <img src={currentSong.artworkUrl100.replace('100x100', '600x600')} alt={currentSong.trackName} className="song-artwork" />
          <div className="song-info">
            <button className="lyrics-button" onClick={handleLyricsClick}><Icon name="lyrics" size={20} /></button>
            <h2>{currentSong.trackName}</h2>
            <p>{currentSong.artistName}</p>
          </div>
          <ProgressBar currentTime={trackProgress.currentTime} duration={trackProgress.duration} onSeek={handleSeek} />
          <div className="playback-controls">
            <div className="volume-control">
                <Icon name="volume" size={20} />
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="volume-slider" />
            </div>
            <div className="main-controls">
                <button className="control-button" onClick={handlePrevSong}><Icon name="previous" size={32} /></button>
                <button className="control-button play-pause-button" onClick={handlePlayPause}>
                  <Icon name={isPlaying ? "pause" : "play"} size={32} />
                </button>
                <button className="control-button" onClick={handleNextSong}><Icon name="next" size={32} /></button>
            </div>
          </div>
        </div>
      ) : <p>No songs found. Try another search.</p>}
      
      {currentSong && <audio key={currentSong.trackId} ref={audioRef} src={currentSong.previewUrl} />}
      {isLyricsModalOpen && <LyricsModal lyrics={lyrics} onClose={() => setIsLyricsModalOpen(false)} isLoading={isLyricsLoading} />}
    </div>
  );
}
