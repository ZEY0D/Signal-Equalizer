import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./freq_graph.css";

const LINEAR_SCALE = "linear";
const AUDIOGRAM_SCALE = "audiogram";
const AUDIOGRAM_TICKS = [125, 250, 500, 1000, 2000, 4000, 8000];
const SVG_WIDTH = 720;
const SVG_HEIGHT = 320;
const PADDING = { top: 24, right: 24, bottom: 32, left: 48 };
const STEP_HZ = 10;
const MIN_LOG_HZ = 125;

const snapToStep = (value, step) => Math.round(value / step) * step;
const normalizeRange = (start, end) =>
  start <= end ? [start, end] : [end, start];

const generateDummySpectrum = () => {
  const points = [];
  const maxHz = 8000;
  for (let hz = 0; hz <= maxHz; hz += 10) {
    const magnitude =
      40 +
      20 * Math.sin(hz / 400) +
      10 * Math.cos(hz / 90) +
      (hz === 0 ? 0 : 50 / Math.log10(hz + 10));
    points.push({ frequency: hz, magnitude: Math.max(0, magnitude) });
  }
  return points;
};

const FrequencyGraph = ({ initialData = generateDummySpectrum() }) => {
  const [frequencyData, setFrequencyData] = useState(initialData);
  const [scale, setScale] = useState(LINEAR_SCALE);
  const [sliderList, setSliderList] = useState([]);
  const [draftRange, setDraftRange] = useState({ startHz: 500, endHz: 1500 });

  const usableWidth = SVG_WIDTH - PADDING.left - PADDING.right;
  const usableHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;

  const maxHz = useMemo(
    () => frequencyData.reduce((acc, point) => Math.max(acc, point.frequency), 0),
    [frequencyData]
  );
  const safeMaxHz = Math.max(maxHz, MIN_LOG_HZ);

  useEffect(() => {
    setDraftRange((prev) => {
      let start = Math.min(Math.max(prev.startHz, 0), safeMaxHz - STEP_HZ);
      let end = Math.min(Math.max(prev.endHz, STEP_HZ), safeMaxHz);
      if (end - start < STEP_HZ) {
        end = Math.min(safeMaxHz, start + STEP_HZ);
      }
      if (start === prev.startHz && end === prev.endHz) {
        return prev;
      }
      return { startHz: start, endHz: end };
    });
  }, [safeMaxHz]);

  useEffect(() => {
    setSliderList((prev) => {
      let changed = false;
      const adjusted = prev.map((slider) => {
        let start = Math.min(Math.max(slider.startHz, 0), safeMaxHz - STEP_HZ);
        let end = Math.min(Math.max(slider.endHz, STEP_HZ), safeMaxHz);
        if (end - start < STEP_HZ) {
          end = Math.min(safeMaxHz, start + STEP_HZ);
        }
        if (start !== slider.startHz || end !== slider.endHz) {
          changed = true;
          return { ...slider, startHz: start, endHz: end };
        }
        return slider;
      });
      return changed ? adjusted : prev;
    });
  }, [safeMaxHz]);

  const adjustedFrequencyData = useMemo(() => {
    if (!frequencyData.length) return [];
    return frequencyData.map((point) => {
      const totalGain = sliderList.reduce((acc, slider) => {
        const [rangeStart, rangeEnd] = normalizeRange(
          slider.startHz,
          slider.endHz
        );
        if (
          point.frequency >= rangeStart &&
          point.frequency <= rangeEnd
        ) {
          return acc * slider.gain;
        }
        return acc;
      }, 1);
      return {
        ...point,
        magnitude: point.magnitude * totalGain,
      };
    });
  }, [frequencyData, sliderList]);

  const maxMagnitude = useMemo(
    () =>
      adjustedFrequencyData.reduce(
        (acc, point) => Math.max(acc, point.magnitude),
        0
      ),
    [adjustedFrequencyData]
  );
  const safeMaxMagnitude = maxMagnitude > 0 ? maxMagnitude : 1;

  const scaleX = useCallback(
    (hz) => {
      const clampedHz = Math.min(Math.max(hz, 0), safeMaxHz);
      if (scale === LINEAR_SCALE) {
        return PADDING.left + (clampedHz / safeMaxHz) * usableWidth;
      }
      const minLog = Math.log10(MIN_LOG_HZ);
      const maxLog = Math.log10(safeMaxHz);
      const denominator = maxLog - minLog || 1;
      const logHz = Math.log10(Math.max(MIN_LOG_HZ, clampedHz));
      return PADDING.left + ((logHz - minLog) / denominator) * usableWidth;
    },
    [scale, safeMaxHz, usableWidth]
  );

  const plot_frequencies = useCallback(
    (dataset = adjustedFrequencyData) => {
      if (!dataset.length) return "";
      return dataset
        .map((point, index) => {
          const x = scaleX(point.frequency);
          const normalizedMag = point.magnitude / safeMaxMagnitude;
          const y =
            PADDING.top +
            (1 - Math.min(Math.max(normalizedMag, 0), 1)) * usableHeight;
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    },
    [adjustedFrequencyData, scaleX, safeMaxMagnitude, usableHeight]
  );

  const frequencyPath = plot_frequencies(adjustedFrequencyData);

  const draw_sliders = useCallback(
    (list = sliderList) =>
      list.map((slider) => {
        const gain = slider.gain ?? 1;
        const [start, end] = normalizeRange(slider.startHz, slider.endHz);
        const startX = scaleX(start);
        const endX = scaleX(end);
        const width = Math.max(Math.abs(endX - startX), 2);
        const palette =
          gain > 1
            ? { fill: "rgba(16, 185, 129, 0.2)", stroke: "rgba(16, 185, 129, 0.7)" }
            : gain < 1
            ? { fill: "rgba(248, 113, 113, 0.18)", stroke: "rgba(248, 113, 113, 0.7)" }
            : { fill: "rgba(244, 114, 182, 0.24)", stroke: "rgba(236, 72, 153, 0.9)" };
        return {
          ...slider,
          x: Math.min(startX, endX),
          width,
          displayGain: `${gain.toFixed(2)}×`,
          ...palette,
        };
      }),
    [scaleX, sliderList]
  );

  const sliderShapes = draw_sliders(sliderList);

  const toggle_scale = (nextScale) => {
    if (nextScale !== scale) {
      setScale(nextScale);
    }
  };

  const handleDraftRangeChange = (field, rawValue) => {
    const numeric = snapToStep(Number(rawValue), STEP_HZ);
    setDraftRange((prev) => {
      let nextStart = prev.startHz;
      let nextEnd = prev.endHz;
      if (field === "startHz") {
        nextStart = Math.min(Math.max(0, numeric), safeMaxHz - STEP_HZ);
        if (nextStart > nextEnd - STEP_HZ) {
          nextEnd = Math.min(safeMaxHz, nextStart + STEP_HZ);
        }
      } else {
        nextEnd = Math.max(Math.min(safeMaxHz, numeric), STEP_HZ);
        if (nextEnd < nextStart + STEP_HZ) {
          nextStart = Math.max(0, nextEnd - STEP_HZ);
        }
      }
      return { startHz: nextStart, endHz: nextEnd };
    });
  };

  const addSliderFromDraft = () => {
    const [start, end] = normalizeRange(
      draftRange.startHz,
      draftRange.endHz
    );
    const nextId = sliderList.length
      ? sliderList[sliderList.length - 1].id + 1
      : 1;
    setSliderList((prev) => [
      ...prev,
      {
        id: nextId,
        startHz: start,
        endHz: end,
        gain: 1,
        label: `Range ${nextId}`,
      },
    ]);
  };

  const updateSliderRange = (id, field, rawValue) => {
    const numeric = snapToStep(Number(rawValue), STEP_HZ);
    setSliderList((prev) =>
      prev.map((slider) => {
        if (slider.id !== id) return slider;
        let { startHz, endHz } = slider;
        if (field === "startHz") {
          startHz = Math.min(Math.max(0, numeric), safeMaxHz - STEP_HZ);
          if (startHz > endHz - STEP_HZ) {
            endHz = Math.min(safeMaxHz, startHz + STEP_HZ);
          }
        } else {
          endHz = Math.max(Math.min(safeMaxHz, numeric), STEP_HZ);
          if (endHz < startHz + STEP_HZ) {
            startHz = Math.max(0, endHz - STEP_HZ);
          }
        }
        return { ...slider, startHz, endHz };
      })
    );
  };

  const updateSliderGain = (id, rawValue) => {
    const numeric = Math.min(2, Math.max(0, Number(rawValue)));
    setSliderList((prev) =>
      prev.map((slider) =>
        slider.id === id ? { ...slider, gain: numeric } : slider
      )
    );
  };

  const updateSliderLabel = (id, value) => {
    setSliderList((prev) =>
      prev.map((slider) =>
        slider.id === id ? { ...slider, label: value } : slider
      )
    );
  };

  const removeSlider = (id) => {
    setSliderList((prev) => prev.filter((slider) => slider.id !== id));
  };

  const refreshDummyData = () => {
    setFrequencyData(generateDummySpectrum());
  };

  const canAddDraft =
    draftRange.endHz - draftRange.startHz >= STEP_HZ;

  const draftLeftPercent = (draftRange.startHz / safeMaxHz) * 100;
  const draftWidthPercent =
    ((draftRange.endHz - draftRange.startHz) / safeMaxHz) * 100;

  const linearTicks = useMemo(() => {
    const ticks = [];
    const tickStep = 1000;
    if (safeMaxHz <= tickStep) {
      ticks.push(0, safeMaxHz);
      return ticks;
    }
    for (let hz = 0; hz <= safeMaxHz; hz += tickStep) {
      ticks.push(hz);
    }
    if (ticks[ticks.length - 1] !== safeMaxHz) {
      ticks.push(safeMaxHz);
    }
    return ticks;
  }, [safeMaxHz]);

  const audiogramTicks = useMemo(
    () => AUDIOGRAM_TICKS.filter((tick) => tick <= safeMaxHz),
    [safeMaxHz]
  );

  return (
    <section className="freq-root">
      <header className="freq-header">
        <h2 className="freq-title">Frequency Domain View</h2>
        <button
          onClick={() => toggle_scale(LINEAR_SCALE)}
          className={`scale-button ${
            scale === LINEAR_SCALE ? "scale-button--active" : ""
          }`}
        >
          Linear
        </button>
        <button
          onClick={() => toggle_scale(AUDIOGRAM_SCALE)}
          className={`scale-button ${
            scale === AUDIOGRAM_SCALE ? "scale-button--active" : ""
          }`}
        >
          Audiogram (dB)
        </button>
        <button className="refresh-button" onClick={refreshDummyData}>
          Refresh Dummy Data
        </button>
      </header>

      <section className="range-planner">
        <h3 className="planner-heading">Range Planner</h3>
        <p className="planner-text">
          Drag the handles to choose the frequency span, then click “Add slider” to pin it on the graph.
        </p>
        <div className="range-summary">
          <strong>{draftRange.startHz} Hz</strong> →{" "}
          <strong>{draftRange.endHz} Hz</strong>
        </div>
        <div className="freq-range-slider">
          <div className="track" />
          <div
            className="selected-range"
            style={{
              left: `${draftLeftPercent}%`,
              width: `${draftWidthPercent}%`,
            }}
          />
          <input
            className="thumb thumb-left"
            type="range"
            min="0"
            max={safeMaxHz}
            step={STEP_HZ}
            value={draftRange.startHz}
            onChange={(event) =>
              handleDraftRangeChange("startHz", event.target.value)
            }
          />
          <input
            className="thumb thumb-right"
            type="range"
            min="0"
            max={safeMaxHz}
            step={STEP_HZ}
            value={draftRange.endHz}
            onChange={(event) =>
              handleDraftRangeChange("endHz", event.target.value)
            }
          />
        </div>
        <div className="planner-actions">
          <button
            onClick={addSliderFromDraft}
            disabled={!canAddDraft}
            className="add-range-button"
          >
            Add slider for this range
          </button>
        </div>
      </section>

      <div className="graph-card">
        <svg
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="freqFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(37, 99, 235, 0.3)" />
              <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
            </linearGradient>
          </defs>

          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={usableWidth}
            height={usableHeight}
            className="graph-background"
          />

          <line
            x1={PADDING.left}
            x2={PADDING.left}
            y1={PADDING.top}
            y2={SVG_HEIGHT - PADDING.bottom}
            className="axis-line"
          />
          <line
            x1={PADDING.left}
            x2={SVG_WIDTH - PADDING.right}
            y1={SVG_HEIGHT - PADDING.bottom}
            y2={SVG_HEIGHT - PADDING.bottom}
            className="axis-line"
          />

          {sliderShapes.map((slider) => (
            <g key={`slider-${slider.id}`}>
              <rect
                x={slider.x}
                y={PADDING.top}
                width={slider.width}
                height={usableHeight}
                fill={slider.fill}
                stroke={slider.stroke}
                strokeDasharray="6 6"
                rx={6}
                ry={6}
              />
              <text
                x={slider.x + slider.width / 2}
                y={PADDING.top + 16}
                className="slider-label"
              >
                {slider.label} • {slider.displayGain}
              </text>
            </g>
          ))}

          <path
            d={frequencyPath}
            className="frequency-path"
          />

          <g>
            {(scale === LINEAR_SCALE ? linearTicks : audiogramTicks).map(
              (tickHz) => {
                const clampedHz = Math.min(
                  Math.max(tickHz, 0),
                  safeMaxHz
                );
                if (scale === AUDIOGRAM_SCALE && tickHz < MIN_LOG_HZ) return null;
                const x = scaleX(clampedHz);
                return (
                  <g key={`tick-${tickHz}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={SVG_HEIGHT - PADDING.bottom}
                      y2={SVG_HEIGHT - PADDING.bottom + 6}
                      className="tick-line"
                    />
                    <text
                      x={x}
                      y={SVG_HEIGHT - PADDING.bottom + 20}
                      className="tick-label"
                    >
                      {tickHz} Hz
                    </text>
                  </g>
                );
              }
            )}
          </g>

          {[0, 20, 40, 60, 80].map((mag) => {
            const normalized = mag / safeMaxMagnitude;
            const y =
              PADDING.top +
              (1 - Math.min(Math.max(normalized, 0), 1)) * usableHeight;
            return (
              <g key={`mag-${mag}`}>
                <line
                  x1={PADDING.left - 6}
                  x2={PADDING.left}
                  y1={y}
                  y2={y}
                  className="tick-line"
                />
                <text
                  x={PADDING.left - 10}
                  y={y + 4}
                  className="tick-label tick-label--left"
                >
                  {mag} dB
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <section className="slider-controls">
        <header>
          <h3>Slider Controls</h3>
          <div className="badge">
            Gain control range: 0× (mute) → 2× (boost)
          </div>
        </header>

        <div className="slider-list">
          {sliderList.map((slider) => (
            <div className="slider-card" key={`control-${slider.id}`}>
              <div className="slider-card-content">
                <strong>{slider.label}</strong>
                <label className="slider-field">
                  Label
                  <input
                    type="text"
                    value={slider.label}
                    onChange={(event) =>
                      updateSliderLabel(slider.id, event.target.value)
                    }
                  />
                </label>
                <label className="slider-field">
                  Start (Hz)
                  <input
                    type="number"
                    value={slider.startHz}
                    step={STEP_HZ}
                    min={0}
                    max={safeMaxHz}
                    onChange={(event) =>
                      updateSliderRange(slider.id, "startHz", event.target.value)
                    }
                  />
                </label>
                <label className="slider-field">
                  End (Hz)
                  <input
                    type="number"
                    value={slider.endHz}
                    step={STEP_HZ}
                    min={0}
                    max={safeMaxHz}
                    onChange={(event) =>
                      updateSliderRange(slider.id, "endHz", event.target.value)
                    }
                  />
                </label>
                <div className="slider-gain">
                  <span className="slider-gain-label">
                    Gain ({slider.gain.toFixed(2)}×)
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={slider.gain}
                    onChange={(event) =>
                      updateSliderGain(slider.id, event.target.value)
                    }
                  />
                  <span className="slider-gain-note">
                    0× = mute, 1× = unchanged, 2× = double
                  </span>
                </div>
                <button
                  onClick={() => removeSlider(slider.id)}
                  className="remove-button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {sliderList.length === 0 && (
            <p className="empty-state">
              No sliders yet — pick a range above and click “Add slider” to start sculpting.
            </p>
          )}
        </div>
      </section>
    </section>
  );
};

export default FrequencyGraph;