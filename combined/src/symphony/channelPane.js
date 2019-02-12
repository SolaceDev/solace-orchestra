import {jst}             from 'jayesstee';
import {defs}            from '../defs.js';

const sliderTimeMs    =      1500;
const colours         = ['#0074d9', '#d83439', '#38b439', '#e9cd54',
                         '#811ed1', '#e66224', '#e041ab', 'blue', 'red'];

export class ChannelPane extends jst.Object {
  constructor(symphony, channel) {
    super();
    this.symphony  = symphony;
    this.fields    = Object.assign({}, channel);
    this.sliders   = [];
    this.timeouts  = [];
  }

  cssLocal() {
    return {
      channelPane$c: {
        position:   "relative",
        width$px:  300,
        height$px: 300,
        border$px: [1, "solid", "#555"],
        margin$px: 4,
        boxShadow$px: [0,0,5,jst.rgba(0,0,0,0.3)]
      },
      header$c: {
        backgroundColor: defs.global.color.primary,
        color:           'white',
        whiteSpace:      'nowrap',
        overflow:        'hidden',
        padding$px:      2,
        borderRadius$px: 2
      },
      title$c: {
        display:         'inline-block',
        padding$px:      2
      },
      instrument$c: {
        display:         'inline-block',
        fontSize:        '75%',
        backgroundColor: defs.global.color.primaryHilight,
        margin$px:       [0,10],
        padding$px:      [1,5],
        borderRadius$px: 3
      },
      lineContainer$c: {
        margin$px:       [10,20,10,15]
      },
      line$c: {
        borderBottom$px: [2, "solid", "#888"],
        borderLeft$px:   [5, "double", "#888"],
        height$px:       27,
      },
      line0$c: {
        borderLeft$px: [0, "none"]
      },
      sliderBox$c: {
        position:        "absolute",
        top$px:          0,
        bottom$px:       0,
        left$px:         20,
        right$px:        20,
        overflow:        "hidden"
      }

    };
  }

  render() {
    return jst.$div(
      {cn: "-channelPane"},
      jst.$div(
        {cn: "-header"},
        jst.$div({cn: "-title"},      `Channel ${this.fields.channel_id}`),
        jst.$div({cn: "-instrument"}, this.fields.instrument_name || "Piano")
      ),
      this.renderLines(),
      jst.$div(
        {cn: "-sliderBox"},
        this.sliders
      )
    );
  }

  renderLines() {
    return jst.$div(
      {cn: "-lineContainer"},
      // inline 8 iteration loop
      [...Array(8).keys()].map(i => jst.$div({cn: `-line -line${i}`}))
    );
  }

  addSlider(delay, track, duration) {
    let sliderDelay = delay - sliderTimeMs;

    this.timeouts.push(window.setTimeout(() => {
      this.addSliderAfterDelay(track, duration);
    }, sliderDelay));
  }

  addSliderAfterDelay(track, duration) {
    if (!this.symphony.checkAndAddSlider()) {
      return;
    }
    let id = this.sliderIds++;
    duration = duration > sliderTimeMs ? sliderTimeMs : duration;

    this.sliders.push(new Slider(track, duration));

    // Remove the slider after it hits the end
    this.timeouts.push(window.setTimeout(e => {
      this.sliders.shift();
      this.refresh();
      this.symphony.removeSlider();
    }, sliderTimeMs + duration + 50));
    this.refresh();
  }

  addNote(note) {
    let delay       = note.play_time - this.symphony.messaging.getTime();
    let sliderDelay = delay - sliderTimeMs;
    let track       = note.track;
    this.addSlider(delay, track, note.duration);
  }

  remove() {
    this.timeouts.map(to => window.clearTimeout(to));
  }
  
}


export class Slider extends jst.Object {
  constructor(track, duration) {
    super();
    this.track    = track;
    this.duration = duration;
  }

  cssLocal() {
    const stepSize = 29;
    let sliderTop  = 27;
    let colourIdx  = 0;
    return {
      slider$c: {
        position:                "absolute",
        left$px:                 -260,
        height$px:               26,
        borderRadius$px:         13,
        animationDuration:       `${sliderTimeMs*2}ms`,
        animationName:           "slide",
        animationTimingFunction: "linear"
      },

      slider0$c: {
        top$px:           sliderTop,
        backgroundColor:  colours[colourIdx++]
      },
      slider1$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },
      slider2$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },
      slider3$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },
      slider4$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },
      slider5$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },
      slider6$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },
      slider7$c: {
        top$px: sliderTop+=stepSize,
        backgroundColor:  colours[colourIdx++]
      },

      $keyframes: {
        $rule: "slide",
        from: {
          left$px:  260
        },
        to: {
          left$px:  -260
        }
      }
    };
  }

  cssInstance() {
    return {
      slider$c: {
        width$px: this.duration/6
      }
    };
  }
  
  render() {
    return jst.$div({cn: `-slider -slider${this.track} --slider`});
  }

}
