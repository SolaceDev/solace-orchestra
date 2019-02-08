import {jst}             from 'jayesstee';
import {defs}            from '../defs.js';
import {RemoteComponentList,
        LocalComponent}  from './common.js';
import {templates,
        formatters}      from '../templates.js';

export class Songs extends RemoteComponentList {
  constructor(dashboard) {
    super(dashboard);
    this.component   = "song";
    this.type        = Song;
    this.currentSong = undefined;

    this.fields = [
      {title: "",           name: "action"},
      {title: "Name",       name: "song_name"},
      {title: "Length",     name: "song_length", format: formatters.secsToTime},
      {title: "# Channels", name: "numChannels"},
      {title: "Conductor",  name: "conductor_name"},
    ];
    
  }

  cssLocal() {
    return {
      actionCell$c: {
        minWidth$em: 1
      },
      
      actionButton$c: {
        cursor:     "pointer",
      },

      actionButton$c$hover: {
        color:      "blue",
      },

      actionInactive$c: {
        cursor:     "default",
        opacity:    0.5,
      },

      actionInactive$c$hover: {
        color:      "black",
      },

    };
  }
  
  removeSongsForConductor(id) {
    this.items = this.items.filter(val => val.conductor_id !== id);
  }

  rxCompleteSong(topic, message) {
    this.currentSong.stop();
  }

  setCurrentSong(song) {
    if (this.currentSong) {
      this.currentSong.stop();
    }
    this.currentSong = song;
  }

  stopCurrentSong() {
    if (this.currentSong) {
      this.currentSong.stop();
    }
    delete this.currentSong;
  }

  sortFunc(a, b) {
    return a.fields.numChannels - b.fields.numChannels;
  }
  
}


class Song extends LocalComponent {
  constructor(messaging, parent, me) {
    super(messaging, parent, me);

    this.amPlaying     = false;
    this.fields.action = () => this.renderActionCell();
  }

  renderActionCell() {
    return jst.$i(
      {events: {click: e => this.actionClicked()},
       cn: "-actionButton fa " +
       (typeof this.parent.currentSong !== "undefined" ?
        this.amPlaying ?
        "fa-stop-circle" :
        "fa-play-circle song-action-inactive" :
        "fa-play-circle")
      }
    );
  }

  actionClicked() {
    if (this.amPlaying) {
      this.stop(true);
    }
    else if (this.parent.currentSong) {
      // Do nothing - must stop current song first
    }
    else {
      this.start();
    }
  }

  stop(sendMessage) {
    if (this.amPlaying) {
      this.amPlaying = false;
      this.parent.dashboard.statusUpdate(`Stopped playing ${this.fields.song_name}`);
      if (sendMessage) {
        let msg = {
          msg_type:       "stop_song",
          song_id:        this.fields.song_id,
          song_name:      this.fields.song_name
        };
        let topic = `orchestra/theatre/default`;
        this.messaging.sendMessage(topic, msg);
      }
      this.parent.stopCurrentSong();
      this.refresh();
    }
  }

  start() {
    
    this.parent.setCurrentSong(this);
    this.amPlaying     = true;
    this.parent.dashboard.statusUpdate(`${this.fields.song_name} is now playing`);
    this.sendStartSongMessage();
    this.refresh();
  }

  sendStartSongMessage() {
    // Send the message out to all registered components
    let msg = {
      msg_type:       "start_song",
      song_id:        this.fields.song_id,
      song_name:      this.fields.song_name,
      song_length:    this.fields.song_name,
      song_channels:  this.fields.song_channels,
      theatre_id:     'default',
      start_time:     this.messaging.getTime() + this.parent.dashboard.startTimeOffset,
    };

    // Send to the specific conductor
    let conductorId   = this.fields.conductor_id;
    //conductor.state = "waiting";
    console.log("sending conductor message", conductorId);
    msg.time_server_topic = `orchestra/p2p/${conductorId}`;

    this.messaging.sendMessage(`orchestra/p2p/${conductorId}`,
                               msg,
                               (txMessage, rxMessage) => {
                                 this.handleStartSongResponse(conductorId, txMessage, rxMessage);
                               }, 2000, 4);
    
    // TODO - refactor
    let symphonies = this.parent.dashboard.getComponent("symphony");
    for (let component of symphonies.items) {
      component.state = "waiting";
      this.messaging.sendMessage(`orchestra/p2p/${component.fields.client_id}`,
                                 msg,
                                 (txMessage, rxMessage) => {
                                   this.handleStartSongResponse(component, component, rxMessage);
                                 }, 2000, 4);
    }

    let index = 0;
    let count = 0;
	// TODO - refactor
	let playableChannels = this.fields.channelList.filter(c => {
		return c.instrument_name !== "skip";
	});

    let musicians = this.parent.dashboard.getComponent("musician");
    for (let component of musicians.items) {
      if (component.disabled) {
        continue;
	  }
      component.state = "waiting";
	  let txMsg = Object.assign({}, msg);
	  let channelId = playableChannels[index++].channel_id;
	  if (component.fields.name) {
		var matches = component.fields.name.match(/\d+$/);
		if (matches) {
			channelId = matches[0];
		}
	  }
      txMsg.channel_id = channelId;
      component.fields.channel_id = channelId;
      count++;
      this.messaging.sendMessage(`orchestra/p2p/${component.fields.client_id}`,
                                 txMsg,
                                 (txMessage, rxMessage) => {
                                   this.handleStartSongResponse(component, component, rxMessage);
                                 }, 2000, 4);
      if (index >= playableChannels.length) {
        index = 0;
      }
    }

    this.refresh();
    
  }
  

  handleStartSongResponse(conductor, txMessage, rxMessage) {
    console.log("Start song response");
  }
  
}
