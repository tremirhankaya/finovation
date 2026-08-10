from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


OUTPUT = Path(
    r"C:\Users\ertun\.codex\visualizations\2026\08\06\019fd951-bdfc-7982-adca-80e095c48f97\old-vs-new-models.html"
)


def build(root: Path | None = None) -> Path:
    root = (root or Path.cwd()).resolve()
    source = root / "artifacts_v22d" / "generation_comparison_20260809"
    daily = pd.read_csv(source / "daily_nav_all_models.csv")
    aggregate = pd.read_csv(source / "aggregate_comparison.csv")
    payload: dict = {"daily": {}, "aggregate": {}}
    for family in ["S1", "S2"]:
        payload["daily"][family] = {}
        frame = daily[daily["family"] == family]
        for generation, key in [("V2.2 eski", "old"), ("V2.2d yeni", "new")]:
            matrix = (
                frame[frame["generation"] == generation]
                .pivot(index="execution_date", columns="model_seed", values="nav")
                .astype(float)
            )
            payload["daily"][family][key] = [
                {
                    "date": str(date),
                    "value": round(float(row.mean()), 2),
                    "low": round(float(row.min()), 2),
                    "high": round(float(row.max()), 2),
                }
                for date, row in matrix.iterrows()
            ]
        passive = frame[frame["model_seed"] == 42].drop_duplicates("execution_date")
        payload["daily"][family]["passive"] = [
            {"date": row.execution_date, "value": round(float(row.passive_nav), 2)}
            for row in passive.itertuples(index=False)
        ]
        payload["aggregate"][family] = {}
        for generation, key in [("V2.2 eski", "old"), ("V2.2d yeni", "new")]:
            row = aggregate[
                (aggregate["family"] == family)
                & (aggregate["generation"] == generation)
            ].iloc[0]
            payload["aggregate"][family][key] = {
                "return": round(float(row["terminal_return_mean"]) * 100, 3),
                "mdd": round(float(row["max_drawdown_mean"]) * 100, 3),
                "commission": round(float(row["total_commission_try_mean"]), 0),
                "updates": round(float(row["target_update_days_mean"]), 1),
            }

    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    fragment = f'''<div id="old-new-model-comparison">
  <h2>Eski V2.2 ve yeni V2.2d — eşlenik senaryo karşılaştırması</h2>
  <div class="viz-controls" aria-label="NAV serileri">
    <button type="button" data-series="old" aria-pressed="true"><span class="legend-swatch old"></span>V2.2 eski</button>
    <button type="button" data-series="new" aria-pressed="true"><span class="legend-swatch new"></span>V2.2d yeni</button>
    <button type="button" data-series="passive" aria-pressed="true"><span class="legend-swatch passive"></span>Pasif fon</button>
  </div>
  <div class="nav-grid">
    <section><h3>S1 — 17 Mart–5 Mayıs 2025</h3><div id="nav-s1" class="chart-host"></div></section>
    <section><h3>S2 — 26 Ağustos–17 Ekim 2025</h3><div id="nav-s2" class="chart-host"></div></section>
  </div>
  <div class="metric-grid">
    <section><h3>Dönem sonu getiri</h3><div id="metric-return" class="metric-host"></div></section>
    <section><h3>Maksimum drawdown</h3><div id="metric-mdd" class="metric-host"></div></section>
    <section><h3>Toplam komisyon</h3><div id="metric-commission" class="metric-host"></div></section>
    <section><h3>Hedef güncelleme günü</h3><div id="metric-updates" class="metric-host"></div></section>
  </div>
  <div class="tooltip" role="tooltip" hidden></div>
</div>
<style>
#old-new-model-comparison {{ color: var(--foreground); width: 100%; position: relative; }}
#old-new-model-comparison h2 {{ margin: 0 0 10px; font-weight: 500; }}
#old-new-model-comparison h3 {{ margin: 8px 0 2px; font-weight: 500; }}
#old-new-model-comparison .nav-grid {{ display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; }}
#old-new-model-comparison .metric-grid {{ display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; margin-top: 16px; }}
#old-new-model-comparison section {{ min-width: 0; }}
#old-new-model-comparison .chart-host {{ min-height: 300px; }}
#old-new-model-comparison .metric-host {{ min-height: 230px; }}
#old-new-model-comparison .viz-controls {{ display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 8px; }}
#old-new-model-comparison .viz-controls button {{ display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--foreground); padding: 2px 0; cursor: pointer; font: inherit; }}
#old-new-model-comparison .viz-controls button[aria-pressed="false"] {{ opacity: .38; }}
#old-new-model-comparison .legend-swatch {{ width: 18px; height: 3px; display: inline-block; }}
#old-new-model-comparison .legend-swatch.old {{ background: var(--viz-series-1); }}
#old-new-model-comparison .legend-swatch.new {{ background: var(--viz-series-2); }}
#old-new-model-comparison .legend-swatch.passive {{ background: var(--foreground); }}
#old-new-model-comparison .tooltip {{ position: absolute; pointer-events: none; z-index: 10; background: var(--popover); color: var(--popover-foreground); border: 1px solid var(--border); padding: 8px; max-width: 220px; }}
#old-new-model-comparison svg text {{ fill: var(--foreground); font-size: 12px; }}
#old-new-model-comparison .axis path, #old-new-model-comparison .axis line {{ stroke: var(--border); }}
#old-new-model-comparison .grid line {{ stroke: var(--border); stroke-opacity: .45; }}
#old-new-model-comparison .grid path {{ display: none; }}
#old-new-model-comparison rect[data-chart-frame] {{ fill: transparent; stroke: var(--border); }}
@media (max-width: 680px) {{
  #old-new-model-comparison .nav-grid, #old-new-model-comparison .metric-grid {{ grid-template-columns: 1fr; }}
  #old-new-model-comparison .chart-host {{ min-height: 285px; }}
}}
</style>
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script>
(() => {{
  const root = document.getElementById('old-new-model-comparison');
  const data = {data};
  const parseDate = d3.timeParse('%Y-%m-%d');
  const enabled = {{old:true,new:true,passive:true}};
  const colors = {{old:'var(--viz-series-1)',new:'var(--viz-series-2)',passive:'var(--foreground)'}};
  const names = {{old:'V2.2 eski',new:'V2.2d yeni',passive:'Pasif fon'}};
  const tooltip = root.querySelector('.tooltip');
  const drawFns = [];
  const fmtTL = v => new Intl.NumberFormat('tr-TR', {{maximumFractionDigits:0}}).format(v) + ' TL';

  function navChart(hostId, family) {{
    const host = root.querySelector('#'+hostId);
    function draw() {{
      host.replaceChildren();
      const width = Math.max(320, host.clientWidth || 500), height = 300;
      const margin = {{top:12,right:18,bottom:50,left:78}};
      const svg = d3.select(host).append('svg').attr('viewBox',`0 0 ${{width}} ${{height}}`).attr('role','img').attr('aria-label',`${{family}} günlük NAV karşılaştırması`);
      svg.append('title').text(`${{family}} günlük NAV karşılaştırması`);
      svg.append('desc').text('Üç seed ortalaması; gölgeler seed minimum ve maksimum aralığını gösterir.');
      const all = Object.values(data.daily[family]).flat().map(d => ({{...d,date:parseDate(d.date)}}));
      const x = d3.scaleTime().domain(d3.extent(all,d=>d.date)).range([margin.left,width-margin.right]);
      const y = d3.scaleLinear().domain(d3.extent(all.flatMap(d=>[d.low??d.value,d.high??d.value]))).nice().range([height-margin.bottom,margin.top]);
      svg.append('rect').attr('data-chart-frame','').attr('x',margin.left).attr('y',margin.top).attr('width',width-margin.left-margin.right).attr('height',height-margin.top-margin.bottom);
      svg.append('g').attr('class','grid').attr('transform',`translate(${{margin.left}},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width-margin.left-margin.right)).tickFormat(''));
      svg.append('g').attr('class','axis').attr('transform',`translate(0,${{height-margin.bottom}})`).call(d3.axisBottom(x).ticks(width<420?4:6).tickFormat(d3.timeFormat('%d %b')));
      svg.append('g').attr('class','axis').attr('transform',`translate(${{margin.left}},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v=>(v/1e6).toFixed(1)+'M'));
      svg.append('text').attr('class','axis-title').attr('data-axis','x').attr('x',(margin.left+width-margin.right)/2).attr('y',height-7).attr('text-anchor','middle').text('İşlem tarihi');
      svg.append('text').attr('class','axis-title').attr('data-axis','y').attr('transform','rotate(-90)').attr('x',-(margin.top+height-margin.bottom)/2).attr('y',16).attr('text-anchor','middle').text('NAV (TL)');
      const line = d3.line().x(d=>x(d.date)).y(d=>y(d.value));
      const area = d3.area().x(d=>x(d.date)).y0(d=>y(d.low)).y1(d=>y(d.high));
      ['old','new'].forEach(key=>{{
        const values=data.daily[family][key].map(d=>({{...d,date:parseDate(d.date)}}));
        if(enabled[key]) svg.append('path').datum(values).attr('d',area).attr('fill',colors[key]).attr('opacity',.13);
        if(enabled[key]) svg.append('path').datum(values).attr('d',line).attr('fill','none').attr('stroke',colors[key]).attr('stroke-width',2.3);
      }});
      const passive=data.daily[family].passive.map(d=>({{...d,date:parseDate(d.date)}}));
      if(enabled.passive) svg.append('path').datum(passive).attr('d',line).attr('fill','none').attr('stroke',colors.passive).attr('stroke-width',1.8).attr('stroke-dasharray','6 4');
      const guide=svg.append('line').attr('data-chart-hover-guide','').attr('y1',margin.top).attr('y2',height-margin.bottom).attr('stroke','var(--border)').attr('visibility','hidden');
      const markerLayer=svg.append('g');
      const overlay=svg.append('rect').attr('data-chart-hit','').attr('data-chart-hover-overlay','cross-series').attr('x',margin.left).attr('y',margin.top).attr('width',width-margin.left-margin.right).attr('height',height-margin.top-margin.bottom).attr('fill','transparent').style('pointer-events','all');
      function interpolate(values,date) {{
        const i=d3.bisector(d=>d.date).center(values,date), a=values[Math.max(0,i-1)], b=values[Math.min(values.length-1,i)];
        if(a.date.getTime()===b.date.getTime()) return a.value;
        const t=(date-a.date)/(b.date-a.date); return a.value+t*(b.value-a.value);
      }}
      overlay.on('pointermove',event=>{{
        const [mx]=d3.pointer(event); const date=x.invert(mx); guide.attr('x1',mx).attr('x2',mx).attr('visibility','visible'); markerLayer.selectAll('*').remove();
        const rows=[];
        ['old','new','passive'].forEach(key=>{{if(!enabled[key]) return; const values=data.daily[family][key].map(d=>({{...d,date:parseDate(d.date)}})); const value=interpolate(values,date); markerLayer.append('circle').attr('data-chart-hover-marker','').attr('cx',mx).attr('cy',y(value)).attr('r',4).attr('fill',colors[key]); rows.push(`<div>${{names[key]}}: ${{fmtTL(value)}}</div>`);}});
        tooltip.innerHTML=`<strong>${{d3.timeFormat('%d.%m.%Y')(date)}}</strong>${{rows.join('')}}`; tooltip.hidden=false; const rr=root.getBoundingClientRect(); tooltip.style.left=(event.clientX-rr.left+12)+'px'; tooltip.style.top=(event.clientY-rr.top+12)+'px';
      }}).on('pointerleave',()=>{{guide.attr('visibility','hidden');markerLayer.selectAll('*').remove();tooltip.hidden=true;}});
    }}
    drawFns.push(draw); draw(); new ResizeObserver(draw).observe(host);
  }}

  function metricChart(hostId, metric, unit, lowerBetter) {{
    const host=root.querySelector('#'+hostId);
    function draw() {{
      host.replaceChildren(); const width=Math.max(320,host.clientWidth||450),height=230,margin={{top:12,right:14,bottom:54,left:68}};
      const rows=[]; ['S1','S2'].forEach(f=>['old','new'].forEach(g=>rows.push({{family:f,generation:g,value:data.aggregate[f][g][metric]}})));
      const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${{width}} ${{height}}`).attr('role','img').attr('aria-label',`${{metric}} karşılaştırması`);
      svg.append('title').text(`${{metric}} karşılaştırması`); svg.append('desc').text('S1 ve S2 için üç seed ortalamaları.');
      const x0=d3.scaleBand().domain(['S1','S2']).range([margin.left,width-margin.right]).padding(.28); const x1=d3.scaleBand().domain(['old','new']).range([0,x0.bandwidth()]).padding(.08);
      const extent=d3.extent(rows,d=>d.value); const base=Math.min(0,extent[0]); const y=d3.scaleLinear().domain([base,Math.max(0,extent[1])*1.22]).nice().range([height-margin.bottom,margin.top]);
      svg.append('rect').attr('data-chart-frame','').attr('x',margin.left).attr('y',margin.top).attr('width',width-margin.left-margin.right).attr('height',height-margin.top-margin.bottom);
      svg.append('g').attr('class','grid').attr('transform',`translate(${{margin.left}},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(width-margin.left-margin.right)).tickFormat(''));
      svg.append('g').attr('class','axis').attr('transform',`translate(0,${{height-margin.bottom}})`).call(d3.axisBottom(x0)); svg.append('g').attr('class','axis').attr('transform',`translate(${{margin.left}},0)`).call(d3.axisLeft(y).ticks(5));
      svg.append('text').attr('class','axis-title').attr('data-axis','x').attr('x',(margin.left+width-margin.right)/2).attr('y',height-8).attr('text-anchor','middle').text('Senaryo');
      svg.append('text').attr('class','axis-title').attr('data-axis','y').attr('transform','rotate(-90)').attr('x',-(margin.top+height-margin.bottom)/2).attr('y',15).attr('text-anchor','middle').text(unit);
      svg.selectAll('rect.metric').data(rows).enter().append('rect').attr('class','metric').attr('x',d=>x0(d.family)+x1(d.generation)).attr('y',d=>y(Math.max(0,d.value))).attr('width',x1.bandwidth()).attr('height',d=>Math.abs(y(d.value)-y(0))).attr('fill',d=>colors[d.generation]).attr('data-tooltip',d=>`${{d.family}} — ${{names[d.generation]}}: ${{d.value.toLocaleString('tr-TR')}} ${{unit}}`);
      svg.selectAll('text.value').data(rows).enter().append('text').attr('class','value').attr('x',d=>x0(d.family)+x1(d.generation)+x1.bandwidth()/2).attr('y',d=>d.value>=0?y(d.value)-5:y(d.value)+14).attr('text-anchor','middle').text(d=>d.value.toLocaleString('tr-TR'));
      if(lowerBetter) svg.append('text').attr('x',width-margin.right).attr('y',margin.top+12).attr('text-anchor','end').attr('fill','var(--muted-foreground)').text('Daha düşük daha iyi');
    }}
    draw(); new ResizeObserver(draw).observe(host);
  }}

  navChart('nav-s1','S1'); navChart('nav-s2','S2');
  metricChart('metric-return','return','Getiri (%)',false); metricChart('metric-mdd','mdd','MDD (%)',true); metricChart('metric-commission','commission','Komisyon (TL)',true); metricChart('metric-updates','updates','Gün',true);
  root.querySelectorAll('[data-series]').forEach(button=>button.addEventListener('click',()=>{{const key=button.dataset.series;enabled[key]=!enabled[key];button.setAttribute('aria-pressed',String(enabled[key]));drawFns.forEach(fn=>fn());}}));
}})();
</script>
'''
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(fragment, encoding="utf-8")
    return OUTPUT


def main() -> None:
    print(build(), flush=True)


if __name__ == "__main__":
    main()
