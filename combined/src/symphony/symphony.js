import {jst}              from 'jayesstee';
import {ChannelPane}      from './channelPane.js';
import {DuckLetterEffect} from '../effects.js';
import Messaging          from '../messaging.js';

    // How much we penalize notes that weren't hit
const velocityDerateFactor = 1;
const maxTotalSliders      = 40;

// Extracted from all current songs
// TODO: need to learn this from all conductors at start time rather than
// hardcoded
const instruments = [0, 4, 9, 22, 24, 25, 28, 29, 30, 33, 40, 41, 42,
                     47, 48, 52, 55, 56, 57, 58, 60, 62, 65, 68, 69,
                     70, 71, 73, 74, 120];

export class Symphony extends jst.Object {
  constructor(app, params) {
    super();
    this.app            = app;

    this.line_spacing   = 20;
    this.allSliders     = [];
    this.timeouts       = [];

    this.hitNotes       = {};
    this.playerNames    = {};
    this.trackPositions = {};

    this.channels       = [];
    this.channelMap     = {};

    this.id             = this.uuid();
    this.songPlaying    = false;

    this.numSliders     = 0;

    // Map of channels that should be played full volume
    // because there are no musicians
    this.activeChannels = {};

    this.audioStarted = false;
    
  }

  cssLocal() {
    return {
      body$c: {
        margin$px: 20,
      },
      heading$c: {
        fontSize: "200%",
        textAlign: "center"
      },
      notice$c: {
        textAlign: "center",
        margin$px: 20
      },
      channelContainer$c: {
        display: "flex",
        flexWrap: "wrap",
        margin$px: [10, 0]
      },
      startAudio$c: {
        textAlign: "center",
        fontSize$px: 30
      },
      startAudioButton$c: {
        display: "inline-block",
        padding$px: 15,
        boxShadow$px: [0,0,5,jst.rgba(0,0,0,0.4)]
      },
      startAudioButton$c$hover: {
        boxShadow$px: [0,0,10,jst.rgba(0,0,0,0.4)],
        backgroundColor: "#ffc"
      }
    };
  }

  render() {
    return jst.$div(
      jst.$div(
        {cn: "-heading"},
        "Symphony"
      ),
      jst.$div(
        {cn: "-body"},
        jst.if(
          this.audioStarted,
          // true
          jst.$div(
            jst.$div({cn: "-notice"},           this.status),
            jst.$div({cn: "-channelContainer"}, this.channels)
          ),
          // false
          jst.$div(
            {cn: "-startAudio"},
            jst.$div(
              {cn: "-startAudioButton",
               events: {click: e => this.startAudio()}}, "Load Instruments"
            )
          )
        )
      )
    );
  }

  startAudio() {

    this.audioStarted = true;
    this.status = "Loading instruments...";
    this.refresh();
    
    this.loadInstruments()
      .then(status => {
        this.messaging = new Messaging({
          callbacks: {
            connected: (...args)         => this.connected(...args),
            start_song: (...args)        => this.rxStartSong(...args),
            stop_song: (...args)         => this.rxStopSong(...args),
            complete_song: (...args)     => this.rxCompleteSong(...args),
            score_update: (...args)      => this.rxScoreUpdate(...args),
            note: (...args)              => this.rxNote(...args),
            play_note: (...args)         => this.rxPlayNote(...args),
            note_list: (...args)         => this.rxNoteList(...args),
            reregister: (...args)        => this.rxRegister(...args),
            register_response: (...args) => this.rxRegisterResponse(...args),
            player_start: (...args)      => this.rxStartPlayer(...args),
          }
        });
      });

  }


  loadInstruments() {
    console.log("Loading " + instruments.length + " instruments...");
    let lastProgress = 0;

    return new Promise((resolve, reject) => {
      window.MIDI.loadPlugin({
        soundfontUrl: "midi/soundfont/MusyngKite/",
        instruments: instruments,
        onprogress: (state, progress) => {
          let percent = (progress*100.0).toFixed(0);
          if (percent - lastProgress > 9) {
            console.log("Instrument loading progress: " + percent + "%");
            if (percent == 100) {
              this.setStatus(`Compiling Instruments...`);
            }
            else {
              this.setStatus(`Instruments loading... (${percent}%)`);
            }
            lastProgress = percent;
          }
        },
        onsuccess: () => {
          console.log("Instruments Loaded!");
          this.setStatus(`Waiting for song to start`);
          resolve("done");
        }
      });


    });
  }

  setStatus(message) {
    //this.status = new DuckLetterEffect(message);
    this.status = message;
    this.refresh();
  }

  addChannel(newChannel) {
    let channel = new ChannelPane(this, newChannel);
    this.channels.push(channel);
    this.channelMap[newChannel.channel_id] = channel;
    this.refresh();
  }

  removeChannel(channel) {
    let index = this.channels.findIndex(c => c.fields.channel_id === channel.fields.channel_id);
    if (index >= 0) {
      this.channels.splice(index, 1);
      delete(this.channelMap[channel.fields.channel_id]);
    }
    else {
      console.warn("Failed to find channel in list", channel, this.channels);
    }
    channel.remove();
    this.refresh();
  }

  connected() {
    console.log("Connected to Solace Messaging");

    this.messaging.subscribe(
      "orchestra/theatre/default",
      "orchestra/theatre/default/spontaneous_note",
      "orchestra/theatre/default/" + this.messaging.WILDCARD,
      "orchestra/theatre/default/" + this.messaging.WILDCARD + "/play_note",
      "orchestra/theatre/default/score_update"
    );

    this.rxRegister();
  }

  rxRegister(topic, message) {
    this.messaging.sendMessage("orchestra/registration", {
      'msg_type':       'register',
      'component_type': 'symphony',
      'name':           'symphony_' + this.id
    });
  }

  rxRegisterResponse(topic, message) {

  }

  rxNoMusicianNotification(topic, message) {
    this.noMusicianChannels[message.channel_id] = true;
  }

  rxStartSong(topic, message) {
    let channelList = [];
    this.activeChannels = {};
    this.songPlaying = true;

    console.log("Starting song:", message);
    this.setStatus(`Playing song: ${message.song_name}`);
    for (let key of Object.keys(message.song_channels)) {
      this.addChannel(message.song_channels[key]);
    }

    //this.buildTracks(channelList);

    this.messaging.sendResponse(message, {});
    this.refresh();
  }

  rxStartPlayer(topic, message) {
    // Remove players for now until they are fixed
    //addPlayer(message.name, message.channel_id);
    this.activeChannels[message.channel_id] = true;
  }

  rxScoreUpdate(topic, message) {
  }

  rxCompleteSong(topic, message) {
    this.rxStopSong(topic, message);
  }
  
  rxStopSong(topic, message) {
    let tempChannels = [].concat(this.channels);
    for (let channel of tempChannels) {
      this.removeChannel(channel);
    }
    this.setStatus(`Waiting for song to start`);
    while(this.timeouts.length > 0) {
      window.clearTimeout(this.timeouts.pop());
    }
    this.refresh();
  }

  rxNote(topic, message) {
    for (let note of message.note_list) {
      note.current_time = new Date().getMilliseconds();
      note.play_time = note.current_time;
      
      let channel = this.channelMap[note.channel];
      if (channel) {
        channel.addNote(note);
      }
      
      window.MIDI.programChange(note.channel, note.program || 0);
      window.MIDI.setVolume(note.channel, 127);
      window.MIDI.noteOn(note.channel, note.note, this.songPlaying ? 15 : 127, 0);
      window.MIDI.noteOff(note.channel, note.note, 0 + 0.5);
    }
  }

  rxPlayNote(topic, message) {
    this.hitNotes[message.note] = 0;
  }

  rxNoteList(topic, message) {
    let self = this;
    for (let note of message.note_list) {
      ((note) => {
        let safeNote = Object.assign({}, note);

        let channel = this.channelMap[note.channel];
        if (channel) {
          channel.addNote(safeNote);
        }
        let delay = safeNote.play_time - self.messaging.getTime();

        this.timeouts.push(window.setTimeout(function () {
          window.MIDI.programChange(safeNote.channel, (safeNote.program || 0));
          window.MIDI.setVolume(safeNote.channel, 127);
          window.MIDI.noteOn(safeNote.channel, safeNote.note, !self.activeChannels[safeNote.channel] || self.hitNotes.hasOwnProperty(note.note_id) ? safeNote.velocity : safeNote.velocity/velocityDerateFactor, 0);
          window.MIDI.noteOff(safeNote.channel, safeNote.note, safeNote.duration/1000);
        }, delay));
      })(note);
    }
  }
  
  uuid() {
    return 'xxxxxxxx'.replace(/[x]/g, function(c) {
      let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  checkAndAddSlider() {
    if (this.numSliders <= maxTotalSliders) {
      this.numSliders++;
      return true;
    }
    return false;
  }

  removeSlider() {
    this.numSliders--;
  }

}
