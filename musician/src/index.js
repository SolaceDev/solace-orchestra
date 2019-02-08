import env         from '../../common/env';
import Messaging   from '../../common/messaging';
import jst         from '../../common/jayesstee';
import $           from 'jquery';
import templates   from './templates';
import instruments from './instruments';

import '../assets/solaceSymphonyInverted.png';
import '../assets/background.png';
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/hero.scss';


class Musician {

  constructor() {
    this.scoreUpdater = undefined;
    this.theatreId    = "default";
    this.channelId    = 0;
    this.messaging    = undefined;

    this.musicianName = '';

    // Knobs for difficulty
    this.hitThreshold           = 200;
    this.notesTooCloseThreshold = 200;

    // Amount of time it takes the slider to slide down the track
    this.sliderTimeSecs = 1.5;

    // Structure that keeps the score
    this.score          = {};

    // Holds all info about instruments
    this.instrumentInfo = {
      list:              [],
      currentInstrument: 0,
      selectOn:          false
    };

    // The current program (or instrument) selected
    this.currentProgram = 0;

    // Master switch on spontaneous notes
    this.amEnabled = true;

    // Keeps all the timers for the sliders
    this.sliderTimeouts = [];

    // Midi note to play when the button is pressed for a track
    // Track is the offset, note is the value;
    this.noteArray = [60, 62, 64, 65, 67, 69, 71];

    // Keep all the sliders added
    this.allSliders = [];

    // Put jayesstee in global mode
    jst.makeGlobal();

    // Finally call setup
    this.setup();

  }


  addDemoSliders() {
    this.addDemoSlider(1, 1, 0);
    this.addDemoSlider(2, 3, 100);
    this.addDemoSlider(3, 2, 200);
    this.addDemoSlider(4, 4, 300);
    this.addDemoSlider(5, 3, 400);
    this.addDemoSlider(6, 5, 500);
    this.addDemoSlider(7, 4, 600);
    this.addDemoSlider(8, 6, 700);
    this.addDemoSlider(9, 5, 800);
    this.addDemoSlider(10, 7, 900);
    this.addDemoSlider(11, 6, 1000);
    this.addDemoSlider(12, 4, 1100);
    this.addDemoSlider(13, 5, 1200);
    this.addDemoSlider(14, 3, 1300);
    this.addDemoSlider(15, 4, 1400);
    this.addDemoSlider(16, 2, 1500);
    this.addDemoSlider(17, 3, 1600);
    this.addDemoSlider(18, 1, 1700);
  }

  setup() {
    this.makeInstrumentList();
    jst("body").replaceChild(templates.page(this.score, "", this.instrumentInfo));
    this.resetScore();
    this.score.spontaneousNotes = 0;

    // Remove address bar
    setTimeout(function(){
      window.scrollTo(0, 1);
    }, 0);

    this.mainLoop();
  }

  mainLoop() {

    $(document).bind('touchmove', function (event) {
      event.preventDefault();
      return false;
    }); // turns off double-hit zoom
    
    document.ontouchmove = function (event) {
      event.preventDefault();
    };

    this.messaging = new Messaging({
      callbacks: {
        connected: (...args)         => this.connected(...args),
        note_list: (...args)         => this.receiveMusicScore(...args),
        start_song: (...args)        => this.startSong(...args),
        stop_song: (...args)         => this.stopSong(...args),
        enable: (...args)            => this.enableMusician(...args),
        disable: (...args)           => this.disableMusician(...args),
        register_response: (...args) => this.registerResponse(...args),
        reregister: (...args)        => this.reregister(...args),
      }
    });

    // Start the demo
    this.addDemoSliders();

    // Show the "get name" modal
    setTimeout(() => {
      $('#getNameModal').modal('toggle');
      $('#lines').hide();
      $('#buttons').hide();
    }, 3200);

    $('#submitName').click(() => this.getName());
    $('#musician-name').on("keypress", (e) => {
      if (e.keyCode == 13) {
        this.getName();
      }
    });
    
  }

  getName() {
    this.musicianName = String($('#musician-name').val());
    if (this.musicianName !== "") {
      $('#getNameModal').modal('toggle');
      this.registerMusician(this.musicianName);
      $('#lines').show();
      $('#buttons').show();
      this.enableButtons();
      this.resetScore();
    }
  }

  makeInstrumentList() {
    const usedInstruments = [0, 4, 9, 22, 24, 25, 28, 29, 30, 33, 40, 41, 42, 47, 48, 52, 55, 56, 57, 58, 60, 62, 65, 68, 69, 70, 71, 73, 74, 120];

    let index = 0;
    for (let program of usedInstruments) {
      let name = instruments[program+1];

      name = name.replace(/_/g, " ");
      name = this.toTitleCase(name);
      
      this.instrumentInfo.list.push({
        index:   index++,
        program: program,
        name:    name
      });
    }

    // Also handle the callback when changed
    this.instrumentInfo.events = {
      selectOn : {
        change: e => {
          this.instrumentInfo.selectOn = false;
          this.setCurrentInstrument(e.target.value);
        }
      },
      selectOff: {
        click: e => {
          this.instrumentInfo.selectOn = true;
          jst.update("instruments");
        }
      }
    };
    
  }

  setCurrentInstrument(instIndex) {
    let instrument                        = this.instrumentInfo.list[instIndex];
    this.instrumentInfo.currentInstrument = instIndex;
    this.currentProgram                   = instrument.program;
    jst.update("instruments");
  }


  toTitleCase(str) {
    return str.replace(/\w\S*/g,
                       function(txt) {
                         return txt.charAt(0).toUpperCase() +
                           txt.substr(1).toLowerCase();
                       });
  }

  startSong(topic, message) {
    console.log("Start song ", topic, message);
    this.resetScore();
    this.channelId = message.channel_id;
    var subscriberTopic = `orchestra/theatre/${this.theatreId}/${this.channelId}`;
    this.messaging.subscribe(
      subscriberTopic
    );

    this.messaging.sendMessage(`orchestra/theatre/${this.theatreId}`, {
      'msg_type': 'player_start',
      'channel_id': this.channelId,
      'name': this.musicianName
    });

    if (this.scoreUpdater) {
      clearInterval(this.scoreUpdater);
    }

    this.scoreUpdater = setInterval(() => {
      this.sendScoreMessage();
    }, 2500);

    this.messaging.sendResponse(message, {});

    // Show the countdown
    this.startCountdown();
    
  }

  sendScoreMessage() {
    let total = this.score.hits + this.score.misses;
    let percent = total ? (100.0 * this.score.hits / total).toFixed(0) : "";
    this.messaging.sendMessage(`orchestra/theatre/${this.theatreId}/score_update`, {
      'msg_type':         'score_update',
      'channel_id':       this.channelId,
      'name':             this.musicianName,
      'hits':             this.score.hits,
      'misses':           this.score.misses,
      'spontaneousNotes': this.score.spontaneousNotes,
      'percent':          percent
    });
  }

  stopSong(topic, message) {
    console.log("Stop song ", topic, message);

    clearInterval(this.scoreUpdater);
    this.scoreUpdater = undefined;

    var subscriberTopic = `orchestra/theatre/${this.theatreId}/${this.channelId}`;
    this.messaging.unsubscribe(
      subscriberTopic
    );
    this.messaging.sendResponse(message, {});

    // Cleanup existing notes
    this.sliderTimeouts.forEach(timeout => clearTimeout(timeout));
    this.sliderTimeouts = [];

    // Remove all sliders
    let sliderDiv = document.getElementById("sliders");
    while (sliderDiv.firstChild) sliderDiv.removeChild(sliderDiv.firstChild);

    // Reset to original channel
    this.channelId = "0";
    
  }

  enableMusician() {
    this.amEnabled = true;
  }

  disableMusician() {
    this.amEnabled = false;
  }

  enableButtons() {
    let eventName = "mousedown";
    if ('ontouchstart' in window || navigator.msMaxTouchPoints) {
      eventName = "touchstart";
    }
    document.getElementById("button1").addEventListener(eventName, (e) => this.buttonPress(e, 1));
    document.getElementById("button2").addEventListener(eventName, (e) => this.buttonPress(e, 2));
    document.getElementById("button3").addEventListener(eventName, (e) => this.buttonPress(e, 3));
    document.getElementById("button4").addEventListener(eventName, (e) => this.buttonPress(e, 4));
    document.getElementById("button5").addEventListener(eventName, (e) => this.buttonPress(e, 5));
    document.getElementById("button6").addEventListener(eventName, (e) => this.buttonPress(e, 6));
    document.getElementById("button7").addEventListener(eventName, (e) => this.buttonPress(e, 7));
  }

  connected() {
    console.log("Connected.");
    // Subscribe to theatreId and channelId
    this.messaging.subscribe(
      "orchestra/theatre/default"
    );
  }

  receiveMusicScore(topic, message) {
    // Sent by the conductor on a per channel basis to let all musicians know what to play and when to play it
    this.addTimedSlider(message);
  }

  registerResponse(message) {
    // Sent by dashboard as a response to registration
    console.log('Received register_response');
  }

  reregister(message) {
    this.registerMusician(this.musicianName);
  }

  publishPlayNoteMessage(messageJSon) {
    var publisherTopic = `orchestra/theatre/${this.theatreId}/${this.channelId}/play_note`;
    messageJSon.msg_type = "play_note";
    this.messaging.sendMessage(publisherTopic, messageJSon);
  }

  publishSpontaneousNoteMessage(messageJSon) {
    // TODO: discuss topic to be used for spontaneous play
    var publisherTopic = `orchestra/theatre/${this.theatreId}/${this.channelId}`;
    messageJSon.msg_type = "note";
    this.messaging.sendMessage(publisherTopic, messageJSon);
  }

  registerMusician(musicianName) {
    var publisherTopic = `orchestra/registration`;
    var messageJson = {
      msg_type: 'register',
      component_type: 'musician',
      name: this.musicianName
    };
    this.messaging.sendMessage(publisherTopic, messageJson);
  }

  addTimedSlider(message) {

    if (message.hasOwnProperty('note_list')) {

      let lastRiders;
      let lastNoteId;
      let lastTime       = -9999;
      let channelProgram = 0;

      // Go over each received note
      message.note_list.forEach(noteMessage => {

        // Add the slider 1.5 seconds ahead of time
        var currentTime       = this.messaging.getSyncedTime();
        var latencyToSymphony = 200;
        var timeoutSeconds    = noteMessage.play_time - currentTime - (this.sliderTimeSecs * 1000) - latencyToSymphony;
        
        if (timeoutSeconds < 0) {
          timeoutSeconds = 0;
        }

        if ((timeoutSeconds - lastTime) < this.notesTooCloseThreshold && lastRiders) {
          
          // Notes too close together in time - just add this note as a rider on the last one
          lastRiders.push({
            message: noteMessage
          });
          
        }
        else {

          // The note has enough of a gap to the last one, create the slider for it
          lastRiders     = new Array();
          lastTime       = timeoutSeconds;
          lastNoteId     = noteMessage.note_id;
		  channelProgram = noteMessage.program;
		  let that = this;

          let self = this;
          (function (riders) {
            self.sliderTimeouts.push(setTimeout(() =>  {
              self.addSlider(noteMessage.note_id, noteMessage.track,
                        noteMessage, riders);
            }, timeoutSeconds));
          })(lastRiders);
          
        }
      });

      // Set the current instrument to be the same as the last received note
      channelProgram = parseInt(channelProgram);
      for (let instEntry of this.instrumentInfo.list) {
        if (instEntry.program == channelProgram) {
          this.setCurrentInstrument(instEntry.index);
          break;
        }
      }
      
      jst.update("instruments");
  
    }
  }

  addDemoSlider(id, track, timeout) {
    setTimeout(() => this.addSlider(id, track),
               timeout);
  }

  buildSlider(id, track, message) {
    let slider     = {};
    slider.element = document.createElement("div");
    slider.track   = track;
    slider.id      = id;
    slider.message = message;

    if (typeof message !== 'undefined') {
      slider.pressed = false;
    } else {
      slider.pressed = true;
    }

    slider.element.className +=
      "slider slider-anim-" + track + " track" + track + " shape color" + track;

    slider.addTime = Date.now();
    return slider;
    
  }

  addSlider(id, track, message, riders) {
    let sliders = document.getElementById("sliders");
    let slider  = this.buildSlider(id, parseInt(track), message);

    // Set the time to remove the slider
    slider.removeTime = Date.now() + this.sliderTimeSecs * 1000;
    slider.riders = riders;

    sliders.appendChild(slider.element);

    this.allSliders.push(slider);

    // Remove the slider after it hits the end
    setTimeout(function () {
      slider.element.remove();
    }, this.sliderTimeSecs * 1000);

    // Remove the event
    setTimeout(() =>  {
      var index = this.allSliders.map((s) => {
        return s.id;
      }).indexOf(id);
      
      var slider = this.allSliders[index];
      
      if (!slider.pressed ||
          'offset' in slider &&
          Math.abs(slider.offset) > this.hitThreshold) {
        // Missed the note
        this.score.misses++;
        this.score.inARow = 0;
        
      }
      else {
        // Hit the note
        this.score.hits++;
        this.score.inARow++;
      }
      
      this.score.total++;
      this.updateScore();

      // Remove the slider
      this.allSliders.splice(index, 1);
      
    }.bind(this), this.sliderTimeSecs * 1000 + 200);

    return slider;

  }

  // Handle button presses on all tracks
  buttonPress(e, track) {

    e.preventDefault();

    let slider = this.allSliders.find(s => !s.pressed && s.track === track);

    let currentTime = Date.now();
    //let currentTime = this.messaging.getSyncedTime();

    if (slider != null) {
      slider.pressed = true;

      var timeOffset = 0;
      if (slider.removeTime != null) {
        timeOffset = currentTime - slider.removeTime;
      } else {
        timeOffset = -((slider.addTime + (this.sliderTimeSecs * 1000)) - currentTime);
      }

      // Send the message
      if (slider.message != null) {
        var noteMsg = {
          current_time: currentTime,
          msg_type: 'play_note',
          note: slider.message.note_id,
          time_offset: timeOffset
        };
        this.publishPlayNoteMessage(noteMsg);
        if (slider.riders.length) {
          for (let rider of slider.riders) {
            let riderMsg = {
              msg_type: 'play_note',
              note: rider.message.note_id,
              time_offset: timeOffset
            };
            this.publishPlayNoteMessage(riderMsg);
          }
        }
      }

    }
    else {

      if (!this.amEnabled) {
        return false;
      }
      
      // There is no note attached to the button press
      // This is a spontaneous note

      // Generate a note based on which button is pressed
      var spontaneousNote = {
        current_time: currentTime,
        msg_type: 'note',
        note_list: [
          {
            program: this.currentProgram,
            track: track,
            note: this.noteArray[track - 1],
            channel: 0,
            duration: 750,
            play_time: currentTime
          }
        ]
      };

      this.score.spontaneousNotes++;
      this.sendScoreMessage();
      this.publishSpontaneousNoteMessage(spontaneousNote);
      
    }

    return false;
    
  }

  resetScore() {
    this.score.hits    = 0;
    this.score.misses  = 0;
    this.score.total   = 0;
    this.score.percent = 0;
    this.score.inARow  = 0;
    this.updateScore();
  }

  updateScore() {
    let scoreDisplay = "";

    let total = this.score.hits + this.score.misses;

    if (total) {
      this.score.percent = (100.0 * this.score.hits / (total)).toFixed(0);
    } else {
      this.score.percent = 0;
    }

    jst.update("score", this.score);

  }

  startCountdown() {
    this.countDownByOne(5);
  }

  countDownByOne(num) {

    if (num <= 0) {
      jst.update("number", "");
      return;
    }

    jst.update("number", num.toString());
    var newNum = num - 1;
    setTimeout(() => this.countDownByOne(newNum), 1000);
  }

}

let musician;
$(document).ready(function () {
  musician = new Musician();
});
