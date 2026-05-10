import { useEffect, useRef, memo } from "react"
import * as d3 from "d3"
import type { MarketPayload } from "../types"

type Props = { data: MarketPayload; width: number; height: number; priceHistory: number[] }

export const MarketViz = memo(function MarketViz({ data, width, height, priceHistory }: Props) {
  const ref = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const svgEl = ref.current
    if (!svgEl) return
    const svg = d3.select(svgEl)
    svg.selectAll("*").remove()

    const margin = { t: 22, r: 10, b: 28, l: 38 }
    const innerW = width - margin.l - margin.r
    const innerH = height - margin.t - margin.b
    const g = svg.append("g").attr("transform", `translate(${margin.l},${margin.t})`)

    const ob = data.order_book
    const bins = ob.bins
    const x = d3.scaleLinear().domain([0, bins - 1]).range([0, innerW])
    const midY = innerH * 0.48
    const maxC = Math.max(1, d3.max([...ob.bids, ...ob.asks], (d) => d) || 1)
    const yScale = d3.scaleLinear().domain([0, maxC]).range([0, midY - 4])

    // asks above mid line (grow upward)
    g.append("g")
      .attr("class", "ob-asks")
      .selectAll("rect")
      .data(ob.asks)
      .enter()
      .append("rect")
      .attr("x", (_d, i) => x(i))
      .attr("y", (d) => midY - yScale(d))
      .attr("width", Math.max(1, innerW / bins - 1))
      .attr("height", (d) => yScale(d))
      .attr("fill", "rgba(255,130,130,0.55)")

    // bids below mid line (grow downward)
    g.append("g")
      .attr("class", "ob-bids")
      .selectAll("rect")
      .data(ob.bids)
      .enter()
      .append("rect")
      .attr("x", (_d, i) => x(i))
      .attr("y", midY)
      .attr("width", Math.max(1, innerW / bins - 1))
      .attr("height", (d) => yScale(d))
      .attr("fill", "rgba(120,255,190,0.45)")

    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", midY)
      .attr("y2", midY)
      .attr("stroke", "rgba(0,229,255,0.25)")
      .attr("stroke-dasharray", "4 4")

    const series = priceHistory.length ? priceHistory : [data.price]
    const extent = d3.extent(series) as [number, number]
    const lo = extent[0] ?? data.price
    const hi = extent[1] ?? data.price
    const pad = Math.max(1e-6, (hi - lo) * 0.08)
    const py = d3.scaleLinear().domain([lo - pad, hi + pad]).range([innerH, innerH * 0.62])
    const px = d3.scaleLinear().domain([0, Math.max(1, series.length - 1)]).range([0, innerW])
    const line = d3
      .line<number>()
      .x((_d, i) => px(i))
      .y((d) => py(d))

    g.append("path")
      .datum(series)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "#00e5ff")
      .attr("stroke-width", 1.25)

    g.append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("fill", "#d6e3ff")
      .attr("font-size", 11)
      .attr("font-family", "IBM Plex Mono, ui-monospace, monospace")
      .text(
        `Px ${data.price.toFixed(2)}   Vol ${data.volume.toFixed(0)}   ${data.shock ? "SHOCK" : "CALM"}`,
      )
  }, [data, width, height, priceHistory])

  return <svg ref={ref} width={width} height={height} className="market-svg" />
})
