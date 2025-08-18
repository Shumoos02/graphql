document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('JWT');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // First get the current eventId
        const eventId = await getCurrentEventId(token) || 1;

        // Fetch all data in parallel for better performance
        const [userData, xpData, auditData] = await Promise.all([
            fetchUserData(token),
            fetchXPData(token, eventId),
            fetchAuditData(token)
        ]);

        displayUserInfo(userData);
        displayXPSummary(xpData);
        renderXPGraph(xpData.transactions);
        renderAuditGraph(auditData);
        
    } catch (error) {
        console.error('Error loading profile data:', error);
        document.getElementById('userInfo').innerHTML = 
            '<p class="error-message">Error loading profile data. Please try again later.</p>';
    }
});

// Data Fetching Functions
async function getCurrentEventId(token) {
    try {
        const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: `{
                    currentEvent: progress(
                        where: {object: {name: {_eq: "Module"}}}
                        order_by: {createdAt: desc}
                        limit: 1
                    ) {
                        eventId
                    }
                }`
            })
        });

        if (response.ok) {
            const { data } = await response.json();
            return data?.currentEvent?.[0]?.eventId || null;
        }
        return null;
    } catch (e) {
        console.warn('Failed to fetch eventId:', e.message);
        return null;
    }
}

async function fetchUserData(token) {
    const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `{
                user {
                    id
                    login
                    email
                    createdAt
                    attrs
                    labels {
                        labelName
                    }
                }
            }`
        })
    });
    
    if (!response.ok) throw new Error('Failed to fetch user data');
    const data = await response.json();
    return data.data.user[0];
}

async function fetchXPData(token, eventId) {
    const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `{
                user{
                    auditRatio
                }
                transaction_aggregate(where: {type: {_eq: "xp"}, eventId: {_eq: ${eventId}}}) {
                    aggregate {
                        sum {
                            amount
                        }
                    }
                }
                level: transaction(
                limit: 1
                order_by: {amount: desc}
                where: {type: {_eq: "level"}, eventId: {_eq: ${eventId}}}
                ) {
                    amount
                }
                    transactions: transaction(
                    where: {type: {_eq: "xp"}, eventId: {_eq: ${eventId}}}
                    order_by: {createdAt: asc}
                ) {
                    amount
                    createdAt
                }
            }`
        })
    });
    
    if (!response.ok) throw new Error('Failed to fetch XP data');
    const data = await response.json();
    
    return {
        totalXP: data.data.transaction_aggregate.aggregate.sum?.amount || 0,
        transactions: data.data.transactions || [],
        auditRatio: data.data.user[0]?.auditRatio || 0,
        level: data.data.level?.[0]?.amount || 0    };
}

async function fetchAuditData(token) {
    const response = await fetch('https://learn.reboot01.com/api/graphql-engine/v1/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: `{
                transaction(
                    where: {type: {_in: ["up", "down"]}},
                    order_by: {createdAt: asc}
                ) {
                    amount
                    type
                    createdAt
                    objectId
                }
            }`
        })
    });
    
    if (!response.ok) throw new Error('Failed to fetch audit data');
    const data = await response.json();
    return data.data.transaction;
}

// Display Functions
function displayUserInfo(user) {
    // Update profile header with username
    const profileHeader = document.querySelector('.profile-header h1');
    profileHeader.textContent = user.login;

    // Update user info section
    const userInfoElement = document.getElementById('userInfo');
    userInfoElement.innerHTML = `
        <div class="user-info-grid">
            <div class="user-info-item">
                <span class="info-label">Email:</span>
                <span class="info-value">${user.email || 'Not provided'}</span>
            </div>
            <div class="user-info-item">
                <span class="info-label">Member since:</span>
                <span class="info-value">${new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
            ${user.labels && user.labels.length > 0 ? `
            <div class="user-info-item">
                <span class="info-label">Cohort:</span>
                <span class="info-value">${user.labels[0].labelName || 'Unknown'}</span>
            </div>
            ` : ''}
        </div>
    `;
}

function displayXPSummary(xpData) {
    const totalXP = Math.round((xpData.totalXP)/1000) || 0;
    const auditRatio = xpData.auditRatio || 0;
    const level = xpData.level || 0;
    const xpSummaryElement = document.getElementById('xpSummary');
    
    xpSummaryElement.innerHTML = `
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-value">${totalXP.toLocaleString()}</div>
                <div class="stat-label">Total XP</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${auditRatio.toFixed(1)}</div>
                <div class="stat-label">Audit Ratio</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${level}</div>
                <div class="stat-label">Level</div>
            </div>
        </div>
    `;
}

// Graph Rendering Functions
function renderXPGraph(transactions) {
    const xpGraphElement = document.getElementById('xpGraph');
    xpGraphElement.innerHTML = '';
    
    if (transactions.length === 0) {
        xpGraphElement.innerHTML = '<p class="no-data">No XP data available</p>';
        return;
    }

    const data = transactions.map(t => ({
        date: new Date(t.createdAt),
        xp: Math.round(t.amount),
        cumulativeXP: Math.round(transactions
            .filter(tt => new Date(tt.createdAt) <= new Date(t.createdAt))
            .reduce((sum, tt) => sum + tt.amount, 0))
    }));

    const width = xpGraphElement.clientWidth;
    const height = xpGraphElement.clientHeight;
    const padding = { top: 30, right: 40, bottom: 50, left: 60 };

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // Calculate min/max dates and XP values
    const minDate = new Date(Math.min(...data.map(d => d.date)));
    const maxDate = new Date(Math.max(...data.map(d => d.date)));
    const minXP = Math.min(...data.map(d => d.cumulativeXP));
    const maxXP = Math.max(...data.map(d => d.cumulativeXP));
    
    // Add buffer to ensure all points are visible
    const xRange = maxDate - minDate || 1; // Avoid division by zero
    const yRange = maxXP - minXP || 1;
    
    const xScale = (width - padding.left - padding.right) / xRange;
    const yScale = (height - padding.top - padding.bottom) / yRange;

    // Create X axis (time)
    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let xAxisPath = `M${padding.left},${height - padding.bottom} L${width - padding.right},${height - padding.bottom}`;
    xAxis.setAttribute("d", xAxisPath);
    xAxis.setAttribute("stroke", "#333");
    xAxis.setAttribute("stroke-width", "1");
    svg.appendChild(xAxis);

    // Add X axis ticks (months)
    const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short' });
    const yearFormatter = new Intl.DateTimeFormat('en', { year: 'numeric' });
    const uniqueMonths = [...new Set(data.map(d => 
        `${d.date.getFullYear()}-${d.date.getMonth()}`
    ))];
    
    uniqueMonths.forEach(month => {
        const [year, monthIndex] = month.split('-');
        const date = new Date(year, monthIndex, 1);
        const x = padding.left + (date - minDate) * xScale;
        
        if (x > padding.left && x < width - padding.right) {
            const tick = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tick.setAttribute("d", `M${x},${height - padding.bottom} L${x},${height - padding.bottom + 5}`);
            tick.setAttribute("stroke", "#333");
            tick.setAttribute("stroke-width", "1");
            svg.appendChild(tick);
            
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", x);
            label.setAttribute("y", height - padding.bottom + 20);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("fill", "#555");
            label.setAttribute("font-size", "10");
            label.textContent = monthFormatter.format(date);
            svg.appendChild(label);
        }
    });

    // Create Y axis (XP)
    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let yAxisPath = `M${padding.left},${height - padding.bottom} L${padding.left},${padding.top}`;
    yAxis.setAttribute("d", yAxisPath);
    yAxis.setAttribute("stroke", "#333");
    yAxis.setAttribute("stroke-width", "1");
    svg.appendChild(yAxis);

    // Add Y axis ticks
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
        const yValue = minXP + (yRange / yTicks) * i;
        const y = height - padding.bottom - (yValue - minXP) * yScale;
        
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tick.setAttribute("d", `M${padding.left - 5},${y} L${padding.left},${y}`);
        tick.setAttribute("stroke", "#333");
        tick.setAttribute("stroke-width", "1");
        svg.appendChild(tick);
        
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", padding.left - 10);
        label.setAttribute("y", y + 4);
        label.setAttribute("text-anchor", "end");
        label.setAttribute("fill", "#555");
        label.setAttribute("font-size", "10");
        label.textContent = Math.round(yValue).toLocaleString();
        svg.appendChild(label);
    }

    // Create line graph - FIXED: Ensure all points are included
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let linePath = '';
    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const x = padding.left + (d.date - minDate) * xScale;
        const y = height - padding.bottom - (d.cumulativeXP - minXP) * yScale;
        
        if (i === 0) {
            linePath += `M${x},${y}`;
        } else {
            linePath += ` L${x},${y}`;
        }
    }
    line.setAttribute("d", linePath);
    line.setAttribute("stroke", "#4285f4");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("fill", "none");
    svg.appendChild(line);

    // Add circle at the last point to indicate current position
    if (data.length > 0) {
        const lastPoint = data[data.length - 1];
        const x = padding.left + (lastPoint.date - minDate) * xScale;
        const y = height - padding.bottom - (lastPoint.cumulativeXP - minXP) * yScale;
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", "#4285f4");
        svg.appendChild(circle);
        
        // Add current XP label
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", x + 10);
        label.setAttribute("y", y - 10);
        label.setAttribute("fill", "#333");
        label.setAttribute("font-weight", "bold");
        label.setAttribute("font-size", "12");
        label.textContent = `${lastPoint.cumulativeXP.toLocaleString()} XP`;
        svg.appendChild(label);
    }

    // Add labels
    const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    xLabel.setAttribute("x", width / 2);
    xLabel.setAttribute("y", height - 10);
    xLabel.setAttribute("text-anchor", "middle");
    xLabel.setAttribute("fill", "#333");
    xLabel.textContent = "Time";
    svg.appendChild(xLabel);

    const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    yLabel.setAttribute("x", 10);
    yLabel.setAttribute("y", height / 2);
    yLabel.setAttribute("text-anchor", "middle");
    yLabel.setAttribute("transform", `rotate(-90, 10, ${height / 2})`);
    yLabel.setAttribute("fill", "#333");
    yLabel.textContent = "Cumulative XP";
    svg.appendChild(yLabel);

    // Add title
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", width / 2);
    title.setAttribute("y", 20);
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("fill", "#333");
    title.setAttribute("font-weight", "bold");
    title.textContent = "XP Progress Over Time";
    svg.appendChild(title);

    xpGraphElement.appendChild(svg);
}

function renderAuditGraph(auditData) {
    const auditGraphElement = document.getElementById('auditGraph');
    auditGraphElement.innerHTML = '';
    
    if (auditData.length === 0) {
        auditGraphElement.innerHTML = '<p class="no-data">No audit data available</p>';
        return;
    }

    const upTotal = auditData
        .filter(t => t.type === 'up')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const downTotal = auditData
        .filter(t => t.type === 'down')
        .reduce((sum, t) => sum + t.amount, 0);

    const ratio = downTotal > 0 ? upTotal / downTotal : upTotal > 0 ? Infinity : 0;
    const ratioDisplay = downTotal > 0 ? ratio.toFixed(2) : upTotal > 0 ? "∞" : "0";

    const width = auditGraphElement.clientWidth;
    const height = auditGraphElement.clientHeight;
    const radius = Math.min(width, height) / 2 - 40;
    const centerX = width / 2;
    const centerY = height / 2;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (upTotal > 0 || downTotal > 0) {
        const upArc = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const total = upTotal + downTotal;
        const upEndAngle = (upTotal / total) * 2 * Math.PI;
        const upPath = describeArc(centerX, centerY, radius, 0, upEndAngle);
        upArc.setAttribute("d", upPath);
        upArc.setAttribute("fill", "#4CAF50");
        upArc.setAttribute("class", "pie-segment");
        svg.appendChild(upArc);

        const downArc = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const downPath = describeArc(centerX, centerY, radius, upEndAngle, 2 * Math.PI);
        downArc.setAttribute("d", downPath);
        downArc.setAttribute("fill", "#F44336");
        downArc.setAttribute("class", "pie-segment");
        svg.appendChild(downArc);
    }

    const ratioText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    ratioText.setAttribute("x", centerX);
    ratioText.setAttribute("y", centerY);
    ratioText.setAttribute("text-anchor", "middle");
    ratioText.setAttribute("dominant-baseline", "middle");
    ratioText.setAttribute("font-size", "24");
    ratioText.setAttribute("font-weight", "bold");
    ratioText.setAttribute("fill", "#333");
    ratioText.textContent = ratioDisplay;
    svg.appendChild(ratioText);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", centerX);
    title.setAttribute("y", 30);
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("font-weight", "bold");
    title.setAttribute("fill", "#333");
    title.textContent = "Audit Ratio (Up/Down)";
    svg.appendChild(title);

    const legendY = centerY + radius + 30;
    
    const upLegend = document.createElementNS("http://www.w3.org/2000/svg", "g");
    upLegend.setAttribute("transform", `translate(${centerX - 100}, ${legendY})`);
    
    const upLegendRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    upLegendRect.setAttribute("width", "15");
    upLegendRect.setAttribute("height", "15");
    upLegendRect.setAttribute("fill", "#4CAF50");
    upLegendRect.setAttribute("rx", "3");
    upLegend.appendChild(upLegendRect);
    
    const upLegendText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    upLegendText.setAttribute("x", "25");
    upLegendText.setAttribute("y", "12");
    upLegendText.setAttribute("fill", "#333");
    upLegendText.textContent = `Earned`;
    upLegend.appendChild(upLegendText);
    
    svg.appendChild(upLegend);

    const downLegend = document.createElementNS("http://www.w3.org/2000/svg", "g");
    downLegend.setAttribute("transform", `translate(${centerX + 20}, ${legendY})`);
    
    const downLegendRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    downLegendRect.setAttribute("width", "15");
    downLegendRect.setAttribute("height", "15");
    downLegendRect.setAttribute("fill", "#F44336");
    downLegendRect.setAttribute("rx", "3");
    downLegend.appendChild(downLegendRect);
    
    const downLegendText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    downLegendText.setAttribute("x", "25");
    downLegendText.setAttribute("y", "12");
    downLegendText.setAttribute("fill", "#333");
    downLegendText.textContent = `Spent`;
    downLegend.appendChild(downLegendText);
    
    svg.appendChild(downLegend);

    auditGraphElement.appendChild(svg);
}

// Helper functions for pie chart
function describeArc(x, y, radius, startAngle, endAngle) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
    return [
        "M", x, y,
        "L", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "Z"
    ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInRadians) {
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
    };
}