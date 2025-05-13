// Final Plot Prototype

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", async function() {
  // Constants for colors
  const FEMALE_COLOR = "#FF1493"; // Deep pink
  const MALE_COLOR = "#0066cc";   // Darker blue
  const LIGHT_PERIOD_COLOR = "#FFFFFF"; // White for light period
  const DARK_PERIOD_COLOR = "#2b2b2b";  // Softer dark background
  const TRANSITION_COLORS = {
    light: "#FFFFFF", // Pure white
    transitioning: "#fff3d4", // Warm amber
    dark: "#2b2b2b"  // Soft dark
  };
  const TEXT_COLORS = {
    light: "#000000", // Black text for light mode
    dark: "#FFFFFF"   // White text for dark mode
  };

  // time mode drop down menu
  const TIME_MODES = {
    normal: {
      name: "Normal (Hour by Hour)",
      interval: 1,
      maxHours: 24,
      filter: (hour) => true,
      getDisplayText: (hour) => `Hour: ${hour}`
    },
    circadian: {
      name: "Circadian Rhythm (12h Light/Dark)",
      interval: 12,
      maxHours: 168, 
      filter: (hour) => true,
      getDisplayText: (hour) => {
        const period = hour % 24 < 12 ? "Light" : "Dark";
        const day = Math.floor(hour / 24) + 1;
        return `Day ${day} - ${period} Period (Hour ${hour % 24})`;
      }
    },
    daily: {
      name: "Day by Day",
      interval: 24,
      maxHours: 336,
      filter: (hour) => true,
      getDisplayText: (hour) => {
        const day = Math.floor(hour / 24) + 1;
        return `Day ${day}`;
      }
    }
  };

  
  const container = d3.select("#visualization-container")
    .append("div")
    .attr("class", "container");

  
  container.append("h2")
    .text("Mouse Data Visualization");

  
  const controls = container.append("div")
    .attr("class", "controls");

  
  const playButton = controls.append("button")
    .attr("id", "playButton")
    .text("Play");

  
  const datasetGroup = controls.append("div")
    .attr("class", "select-group");

  datasetGroup.append("label")
    .attr("for", "datasetSelect")
    .text("Select Dataset:");

  const datasetSelect = datasetGroup.append("select")
    .attr("id", "datasetSelect");

  // dataset optiondrop down menu
  datasetSelect.selectAll("option")
    .data([
      { value: "combined", text: "Combined" },
      { value: "female", text: "Female Only" },
      { value: "male", text: "Male Only" }
    ])
    .enter()
    .append("option")
    .attr("value", d => d.value)
    .text(d => d.text);

  
  const timeModeGroup = controls.append("div")
    .attr("class", "select-group");

  timeModeGroup.append("label")
    .attr("for", "timeModeSelect")
    .text("Time Mode:");

  const timeModeSelect = timeModeGroup.append("select")
    .attr("id", "timeModeSelect");

 
  timeModeSelect.selectAll("option")
    .data(Object.entries(TIME_MODES))
    .enter()
    .append("option")
    .attr("value", d => d[0])
    .text(d => d[1].name);

  const hourGroup = controls.append("div")
    .attr("class", "select-group");

  hourGroup.append("label")
    .attr("for", "hourSelect")
    .text("Select Time Point:");

  const hourSelect = hourGroup.append("select")
    .attr("id", "hourSelect");

  const svg = container.append("svg")
    .attr("id", "chart")
    .attr("width", 1000)
    .attr("height", 600);


  const backgroundRect = svg.append("rect")
    .attr("class", "period-background")
    .attr("width", 1000)
    .attr("height", 600)
    .attr("fill", LIGHT_PERIOD_COLOR);

const margin = { top: 60, right: 40, bottom: 60, left: 70 },
      width = 1000 - margin.left - margin.right,
      height = 600 - margin.top - margin.bottom;

  const chartGroup = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleBand().padding(0.2).range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

  const xAxis = chartGroup.append("g")
    .attr("transform", `translate(0,${height})`)
    .style("stroke-width", "1px");
  const yAxis = chartGroup.append("g")
    .style("stroke-width", "1px");

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);


let currentData = [];
  let femaleData = [];
  let maleData = [];
  let isPlaying = false;
  let currentHourIndex = 0;
  let interval;
  let currentDataset = "combined";
  let currentTimeMode = "normal";

  function updateHourOptions() {
    const modeConfig = TIME_MODES[currentTimeMode];
    const hours = Array.from(
      { length: Math.floor(modeConfig.maxHours / modeConfig.interval) },
      (_, i) => i * modeConfig.interval
    ).filter(hour => modeConfig.filter(hour));

    hourSelect.selectAll("option").remove();
    hourSelect.selectAll("option")
      .data(hours)
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d => modeConfig.getDisplayText(d));

    return hours[0];
  }

  async function loadAndProcessData() {
    try {
      
      const [rawFemaleData, rawMaleData] = await Promise.all([
        d3.csv("data/fem_temp.csv"),
        d3.csv("data/male_temp.csv")
      ]);

      
      rawFemaleData.forEach((row, i) => {
        for (const mouse in row) {
          femaleData.push({
            MouseID: mouse,
            Hour: Math.floor(i / 60),
            Minute: i,
            Temperature: +row[mouse],
            Gender: 'female'
          });
        }
      });

     
      rawMaleData.forEach((row, i) => {
        for (const mouse in row) {
          maleData.push({
            MouseID: mouse,
            Hour: Math.floor(i / 60),
            Minute: i,
            Temperature: +row[mouse],
            Gender: 'male'
          });
        }
      });

     
      updateDataset(currentDataset);

      
      const initialHour = updateHourOptions();
      await updateChart(initialHour);

      
      timeModeSelect.on("change", async function() {
        const oldTimeMode = currentTimeMode;
        const oldHour = +hourSelect.property("value");
        currentTimeMode = this.value;
        
        // removes elements from chart when time mode changes
        await new Promise(resolve => {
          chartGroup.selectAll(".bar, .female-bar, .male-bar, .single-bar, .title, .x-axis-label, .y-axis-label, .average-line, .legend")
            .transition()
            .duration(150)
            .style("opacity", 0)
            .remove()
            .on("end", resolve);
        });

        // Clear axes
        xAxis.selectAll("*").remove();
        yAxis.selectAll("*").remove();
        
        
        let newHour;
        const oldConfig = TIME_MODES[oldTimeMode];
        const newConfig = TIME_MODES[currentTimeMode];
        
        if (oldTimeMode === "normal" && currentTimeMode === "circadian") {
          newHour = Math.floor(oldHour / 12) * 12;
        } else if (oldTimeMode === "normal" && currentTimeMode === "daily") {
          newHour = Math.floor(oldHour / 24) * 24;
        } else if (oldTimeMode === "circadian" && currentTimeMode === "normal") {
          newHour = oldHour;
        } else if (oldTimeMode === "circadian" && currentTimeMode === "daily") {
          newHour = Math.floor(oldHour / 24) * 24;
        } else if (oldTimeMode === "daily" && currentTimeMode === "normal") {
          newHour = oldHour;
        } else if (oldTimeMode === "daily" && currentTimeMode === "circadian") {
          newHour = Math.floor(oldHour / 12) * 12;
        } else {
          newHour = oldHour;
        }

       
        updateHourOptions();
        
        
        hourSelect.property("value", newHour);
        currentHourIndex = Math.floor(newHour / newConfig.interval);
        
        
        if (isPlaying) {
          clearInterval(interval);
          isPlaying = false;
          playButton.text("Play");
        }

        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        
        await updateChart(newHour);
      });

      
      datasetSelect.on("change", async function() {
        currentDataset = this.value;
        
       
        chartGroup.selectAll(".bar, .female-bar, .male-bar, .single-bar, .title, .x-axis-label, .y-axis-label, .average-line, .legend")
          .transition()
          .duration(200)
          .style("opacity", 0)
          .remove();

        
        xAxis.selectAll("*").remove();
        yAxis.selectAll("*").remove();
        
        updateDataset(currentDataset);
        await updateChart(+hourSelect.property("value"));
      });

      
      hourSelect.on("change", async function() {
        
        chartGroup.selectAll(".bar, .female-bar, .male-bar, .single-bar")
          .transition()
          .duration(200)
          .style("opacity", 0)
          .remove();
          
        await updateChart(+this.value);
      });

    
      playButton.on("click", async () => {
      if (!isPlaying) {
        isPlaying = true;
        playButton.text("Stop");
    
          interval = setInterval(async () => {
            const modeConfig = TIME_MODES[currentTimeMode];
            const hours = Array.from(
              { length: Math.floor(modeConfig.maxHours / modeConfig.interval) },
              (_, i) => i * modeConfig.interval
            ).filter(hour => modeConfig.filter(hour));
            
          currentHourIndex = (currentHourIndex + 1) % hours.length;
          const currentHour = hours[currentHourIndex];
          hourSelect.property("value", currentHour);

            
            chartGroup.selectAll(".bar, .female-bar, .male-bar, .single-bar")
              .transition()
              .duration(200)
              .style("opacity", 0)
              .remove();
            
            await updateChart(currentHour);
          }, currentTimeMode === 'circadian' ? 3000 : 1000);
      } else {
        isPlaying = false;
        playButton.text("Play");
        clearInterval(interval);
      }
    });
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  function updateDataset(dataset) {
    switch(dataset) {
      case "female":
        currentData = femaleData;
        break;
      case "male":
        currentData = maleData;
        break;
      default:
        currentData = [...femaleData, ...maleData];
    }
  }

  function updateTextColors(isDarkMode, transition = null) {
    const textColor = isDarkMode ? TEXT_COLORS.dark : TEXT_COLORS.light;
    const elements = [
      ".tick text",
      ".tick line",
      ".domain",
      ".title",
      ".x-axis-label",
      ".y-axis-label",
      ".legend text"
    ];

    elements.forEach(selector => {
      const selection = chartGroup.selectAll(selector);
      if (transition) {
        selection
          .transition(transition)
          .style("fill", textColor)
          .style("stroke", textColor);
      } else {
        selection
          .style("fill", textColor)
          .style("stroke", textColor);
      }
    });
  }

  async function updateChart(hour) {
    try {
      
      chartGroup.selectAll(".bar, .female-bar, .male-bar, .single-bar")
        .transition()
        .duration(200)
        .style("opacity", 0)
        .remove();

      const modeConfig = TIME_MODES[currentTimeMode];
      const hourInDay = hour % 24;
      const isDarkPeriod = hourInDay >= 12;
      const isCircadianMode = currentTimeMode === 'circadian';
      const isBoundaryTransition = isCircadianMode && (hourInDay === 0 || hourInDay === 12);

      const textColor = isDarkPeriod ? "white" : "black";

      
      const colorTransition = d3.transition()
        .duration(100)
        .ease(d3.easeLinear);

     
      const dataTransition = d3.transition()
        .duration(800)
        .ease(d3.easeLinear);


  const filtered = currentData.filter(d => d.Hour === hour);
      const groupedData = d3.group(filtered, d => d.MouseID);
      const processedData = Array.from(groupedData, ([key, values]) => {
        if (currentDataset === "combined") {
          const female = values.find(d => d.Gender === 'female') || { Temperature: 0 };
          const male = values.find(d => d.Gender === 'male') || { Temperature: 0 };
          return {
            MouseID: key,
            female: female.Temperature,
            male: male.Temperature
          };
        } else {
          return {
            MouseID: key,
            Temperature: values[0].Temperature,
            Gender: values[0].Gender
          };
        }
      });

      
      let averageValue;
      if (currentDataset === "combined") {
        averageValue = d3.mean(processedData, d => d.female + d.male);
      } else {
        averageValue = d3.mean(processedData, d => d.Temperature);
      }

      
      x.domain(processedData.map(d => d.MouseID));
  y.domain([35, d3.max(filtered, d => d.Temperature) + 0.5]);

     
      const updateAxisColors = (selection, transition) => {
        selection.selectAll(".tick text")
          .transition(transition)
          .duration(100)
          .style("fill", textColor);
        
        selection.selectAll(".tick line")
          .transition(transition)
          .duration(100)
          .style("stroke", textColor)
          .style("stroke-width", "1px");
        
        selection.selectAll(".domain")
          .transition(transition)
          .duration(100)
          .style("stroke", textColor)
          .style("stroke-width", "1px");
      };

      
      const updateAxes = () => {
        xAxis.call(d3.axisBottom(x))
          .selectAll(".tick line, .domain")
          .style("stroke-width", "1px");

        yAxis.call(d3.axisLeft(y))
          .selectAll(".tick line, .domain")
          .style("stroke-width", "1px");
      };

      
      xAxis.transition(dataTransition)
        .call(d3.axisBottom(x))
        .call(g => {
          g.selectAll(".tick line, .domain")
            .style("stroke-width", "1px");
          updateAxisColors(g, colorTransition);
        });

      yAxis.transition(dataTransition)
        .call(d3.axisLeft(y))
        .call(g => {
          g.selectAll(".tick line, .domain")
            .style("stroke-width", "1px");
          updateAxisColors(g, colorTransition);
        });

      
      const updateLabel = (selection, text) => {
        const label = selection.selectAll(".axis-label")
          .data([1]);

        label.exit().remove();

        const labelEnter = label.enter()
          .append("text")
          .attr("class", "axis-label");

        label.merge(labelEnter)
          .attr("text-anchor", "middle")
          .style("font-size", "14px")
          .text(text)
          .transition(colorTransition)
          .style("fill", textColor);

        return label.merge(labelEnter);
      };

      
      const xLabel = chartGroup.selectAll(".x-axis-label")
        .data([1]);

      xLabel.exit().remove();

      xLabel.enter()
        .append("text")
        .merge(xLabel)
    .attr("class", "x-axis-label")
    .attr("x", width / 2)
    .attr("y", height + 45)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
        .text("Mouse ID")
        .transition(colorTransition)
        .style("fill", textColor);

      
      const yLabel = chartGroup.selectAll(".y-axis-label")
        .data([1]);

      yLabel.exit().remove();

      yLabel.enter()
        .append("text")
        .merge(yLabel)
    .attr("class", "y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
        .text("Core Temp (°C)")
        .transition(colorTransition)
        .style("fill", textColor);

      
      const title = chartGroup.selectAll(".title")
        .data([1]);

      title.exit().remove();

      title.enter()
        .append("text")
        .merge(title)
    .attr("class", "title")
    .attr("x", width / 2)
    .attr("y", -20)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
        .text(currentDataset === "combined" ? 
          "Mice in Motion: How does mice temperature change throughout the circadian time?" :
          `Mice in Motion: ${currentDataset.charAt(0).toUpperCase() + currentDataset.slice(1)} Temperature Data`)
        .transition(colorTransition)
        .style("fill", textColor);

      if (isBoundaryTransition) {
        const t1 = d3.transition()
          .duration(200)
          .ease(d3.easeLinear);
        
        const t2 = d3.transition()
          .duration(200)
          .ease(d3.easeLinear)
          .delay(200);

        if (isDarkPeriod) {
          backgroundRect
            .transition(t1)
            .attr("fill", TRANSITION_COLORS.transitioning)
            .transition(t2)
            .attr("fill", TRANSITION_COLORS.dark);
        } else {
          backgroundRect
            .transition(t1)
            .attr("fill", TRANSITION_COLORS.transitioning)
            .transition(t2)
            .attr("fill", TRANSITION_COLORS.light);
        }

        updateAverageLine(averageValue, isDarkPeriod, t2);
        updateLegend(isDarkPeriod, t2);
      } else {
        backgroundRect
          .transition(colorTransition)
          .attr("fill", isDarkPeriod ? TRANSITION_COLORS.dark : TRANSITION_COLORS.light);

        updateAverageLine(averageValue, isDarkPeriod);
        updateLegend(isDarkPeriod);
      }

      
      function updateAverageLine(average, isDark, transition = null) {
        
        chartGroup.selectAll(".average-line").remove();

        
        const averageLine = chartGroup.append("line")
          .attr("class", "average-line")
          .attr("x1", 0)
          .attr("x2", width)
          .attr("y1", y(average))
          .attr("y2", y(average))
          .style("stroke-width", 1.5)
          .style("stroke-dasharray", "5,5");

        if (transition) {
          averageLine.style("stroke", "gray")  
            .transition(transition)
            .style("stroke", isDark ? "white" : "black");
        } else {
          averageLine.style("stroke", isDark ? "white" : "black");
        }
      }

      
      function updateLegend(isDark, transition = null) {
        chartGroup.selectAll(".legend").remove();
        
        if (currentDataset === "combined") {
          const legend = chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 100}, 0)`);

          
          legend.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", FEMALE_COLOR)
            .attr("opacity", 0.7);

          const femaleText = legend.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text("Female");

          legend.append("rect")
            .attr("x", 0)
            .attr("y", 20)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", MALE_COLOR)
            .attr("opacity", 0.7);

          const maleText = legend.append("text")
            .attr("x", 20)
            .attr("y", 32)
            .text("Male");

          const averageLine = legend.append("line")
            .attr("x1", 0)
            .attr("x2", 15)
            .attr("y1", 45)
            .attr("y2", 45)
            .style("stroke-width", 1.5)
            .style("stroke-dasharray", "5,5");

          const averageText = legend.append("text")
            .attr("x", 20)
            .attr("y", 48)
            .text("Average");

          if (transition) {
            [femaleText, maleText, averageText].forEach(text => {
              text.style("fill", "gray")  
                .transition(transition)
                .style("fill", isDark ? "white" : "black");
            });

            averageLine.style("stroke", "gray")  
              .transition(transition)
              .style("stroke", isDark ? "white" : "black");
          } else {
            [femaleText, maleText, averageText].forEach(text => {
              text.style("fill", isDark ? "white" : "black");
            });
            averageLine.style("stroke", isDark ? "white" : "black");
          }
        } else {
          const legend = chartGroup.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 100}, 0)`);

          const averageLine = legend.append("line")
            .attr("x1", 0)
            .attr("x2", 15)
            .attr("y1", 12)
            .attr("y2", 12)
            .style("stroke-width", 1.5)
            .style("stroke-dasharray", "5,5");

          const averageText = legend.append("text")
            .attr("x", 20)
            .attr("y", 15)
            .text("Average");

          if (transition) {
            averageText.style("fill", "gray")  
              .transition(transition)
              .style("fill", isDark ? "white" : "black");

            averageLine.style("stroke", "gray")  
              .transition(transition)
              .style("stroke", isDark ? "white" : "black");
          } else {
            averageText.style("fill", isDark ? "white" : "black");
            averageLine.style("stroke", isDark ? "white" : "black");
          }
        }
      }

      
      const updateBars = (selection, data, className, color) => {
        const bars = selection.selectAll(`.${className}`)
          .data(data, d => d.MouseID);

  bars.exit()
          .transition(dataTransition)
          .attr("y", height)
    .attr("height", 0)
    .remove();
  
  const barsEnter = bars.enter()
    .append("rect")
          .attr("class", className)
    .attr("x", d => x(d.MouseID))
    .attr("width", x.bandwidth())
          .attr("y", height)
    .attr("height", 0)
          .attr("fill", color)
          .attr("opacity", 0.7);

        bars.merge(barsEnter)
          .transition(dataTransition)
          .attr("x", d => x(d.MouseID))
          .attr("width", x.bandwidth())
          .attr("y", d => y(d[className === "female-bar" ? "female" : "male"]))
          .attr("height", d => height - y(d[className === "female-bar" ? "female" : "male"]));

        return bars.merge(barsEnter);
      };

      if (currentDataset === "combined") {
        updateBars(chartGroup, processedData, "female-bar", FEMALE_COLOR)
          .on("mouseover", function(event, d) {
            tooltip.transition()
              .duration(200)
              .style("opacity", 0.9);
            tooltip.html(`Mouse: ${d.MouseID}<br>Female Temp: ${d.female.toFixed(2)}°C`)
              .style("left", (event.pageX) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

        updateBars(chartGroup, processedData, "male-bar", MALE_COLOR)
          .on("mouseover", function(event, d) {
            tooltip.transition()
              .duration(200)
              .style("opacity", 0.9);
            tooltip.html(`Mouse: ${d.MouseID}<br>Male Temp: ${d.male.toFixed(2)}°C`)
              .style("left", (event.pageX) + "px")
              .style("top", (event.pageY - 28) + "px");
          })
          .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
      } else {
        const bars = chartGroup.selectAll(".single-bar")
          .data(processedData, d => d.MouseID);

        bars.exit()
          .transition(dataTransition)
          .attr("y", height)
          .attr("height", 0)
          .remove();

        const barsEnter = bars.enter()
          .append("rect")
          .attr("class", "single-bar")
          .attr("x", d => x(d.MouseID))
          .attr("width", x.bandwidth())
          .attr("y", height)
          .attr("height", 0)
          .attr("fill", currentDataset === "female" ? FEMALE_COLOR : MALE_COLOR)
          .attr("opacity", 0.7);

        bars.merge(barsEnter)
          .transition(dataTransition)
          .attr("x", d => x(d.MouseID))
          .attr("width", x.bandwidth())
          .attr("y", d => y(d.Temperature))
          .attr("height", d => height - y(d.Temperature))
          .on("end", function() {
            d3.select(this)
              .on("mouseover", function(event, d) {
                tooltip.transition()
                  .duration(200)
                  .style("opacity", 0.9);
      tooltip.html(`Mouse: ${d.MouseID}<br>Temp: ${d.Temperature.toFixed(2)}°C`)
        .style("left", (event.pageX) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
              .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
          });
      }

    } catch (error) {
      console.error("Error updating chart:", error);
    }
  }

  
  await loadAndProcessData();
});