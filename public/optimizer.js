/**
 * Event Seat Optimizer - Hybrid Optimization Algorithm
 * 
 * This module implements a sophisticated seating optimization algorithm that combines:
 * 1. Genetic Algorithm (GA) - For global optimization through evolutionary search
 * 2. Simulated Annealing - For local refinement and escaping local optima
 * 3. Greedy Heuristics - For generating high-quality initial solutions
 */

class SeatOptimizer {
    constructor(config = {}) {
        // Algorithm parameters
        this.config = {
            populationSize: config.populationSize || 100,
            generations: config.generations || 200,
            mutationRate: config.mutationRate || 0.15,
            crossoverRate: config.crossoverRate || 0.85,
            elitismCount: config.elitismCount || 5,
            tournamentSize: config.tournamentSize || 5,

            // Simulated Annealing
            initialTemp: config.initialTemp || 1000,
            coolingRate: config.coolingRate || 0.995,
            minTemp: config.minTemp || 1,

            // Weights for fitness components
            weights: {
                friendProximity: (config.friendWeight || 30) / 100,
                vipPlacement: (config.vipWeight || 25) / 100,
                groupCohesion: (config.groupWeight || 25) / 100,
                stageDistance: (config.distanceWeight || 20) / 100
            }
        };

        this.venue = null;
        this.attendees = [];
        this.groups = new Map();
        this.friendships = new Map();

        // Optimization state
        this.currentGeneration = 0;
        this.bestSolution = null;
        this.bestFitness = { total: 0 };
        this.fitnessHistory = [];
        this.isRunning = false;

        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
    }

    setVenue(rows, cols, vipRows = 2) {
        this.venue = {
            rows,
            cols,
            vipRows,
            totalSeats: rows * cols,
            seats: []
        };

        // Create seat matrix with distance to stage
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this.venue.seats.push({
                    id: `${r}-${c}`,
                    row: r,
                    col: c,
                    isVip: r < vipRows,
                    position: r * cols + c,
                    // Euclidean distance from stage center (row -1, col cols/2)
                    distanceToStage: Math.sqrt(Math.pow(r + 1, 2) + Math.pow(c - cols / 2, 2))
                });
            }
        }
    }

    setAttendees(attendees) {
        this.attendees = attendees.map((a, idx) => ({
            ...a,
            id: a.id || idx,
            index: idx,
            priority: a.priority || 5 // Default priority 5/10
        }));

        // Build group mapping
        this.groups.clear();
        this.attendees.forEach(attendee => {
            if (attendee.group) {
                if (!this.groups.has(attendee.group)) {
                    this.groups.set(attendee.group, []);
                }
                this.groups.get(attendee.group).push(attendee.index);
            }
        });

        // Build friendship mapping
        this.friendships.clear();
        this.groups.forEach((members) => {
            members.forEach(m1 => {
                if (!this.friendships.has(m1)) {
                    this.friendships.set(m1, new Set());
                }
                members.forEach(m2 => {
                    if (m1 !== m2) {
                        this.friendships.get(m1).add(m2);
                    }
                });
            });
        });
    }

    getSeatDistance(seat1, seat2) {
        return Math.abs(seat1.row - seat2.row) + Math.abs(seat1.col - seat2.col);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    generateRandomChromosome() {
        const availableSeats = Array.from({ length: this.venue.totalSeats }, (_, i) => i);
        this.shuffleArray(availableSeats);
        return availableSeats.slice(0, this.attendees.length);
    }

    generateGreedySolution() {
        const chromosome = new Array(this.attendees.length).fill(-1);
        const usedSeats = new Set();

        // Sort attendees by importance: VIP -> Priority -> Group Size
        const sortedIndices = this.attendees
            .map((a, i) => ({ attendee: a, index: i }))
            .sort((a, b) => {
                // 1. VIP status
                if (a.attendee.type === 'vip' && b.attendee.type !== 'vip') return -1;
                if (a.attendee.type !== 'vip' && b.attendee.type === 'vip') return 1;

                // 2. Priority Level (Higher is better)
                if (a.attendee.priority !== b.attendee.priority) {
                    return b.attendee.priority - a.attendee.priority;
                }

                // 3. Group Size
                const groupA = a.attendee.group ? this.groups.get(a.attendee.group)?.length || 0 : 0;
                const groupB = b.attendee.group ? this.groups.get(b.attendee.group)?.length || 0 : 0;
                return groupB - groupA;
            })
            .map(item => item.index);

        // Assign seats greedily
        for (const attendeeIdx of sortedIndices) {
            const attendee = this.attendees[attendeeIdx];
            let bestSeat = -1;
            let bestScore = -Infinity;

            for (let seatPos = 0; seatPos < this.venue.totalSeats; seatPos++) {
                if (usedSeats.has(seatPos)) continue;

                const seat = this.venue.seats[seatPos];
                let score = 0;

                // Scoring Heuristics

                // VIP Placement
                if (attendee.type === 'vip') {
                    score += seat.isVip ? 200 : -100;
                }

                // Priority Score (Higher priority prefers closer to stage)
                // Normalize priority to 0-1 range (assuming max priority 10)
                const priorityWeight = attendee.priority / 10;
                score += (200 * priorityWeight) / (seat.distanceToStage + 1);

                // Preference Score
                if (attendee.preference === 'front' && seat.row < this.venue.rows / 3) score += 50;
                else if (attendee.preference === 'middle' && seat.row >= this.venue.rows / 3 && seat.row < 2 * this.venue.rows / 3) score += 50;
                else if (attendee.preference === 'back' && seat.row >= 2 * this.venue.rows / 3) score += 50;

                // Group Proximity
                if (attendee.group && this.groups.has(attendee.group)) {
                    for (const memberIdx of this.groups.get(attendee.group)) {
                        if (chromosome[memberIdx] !== -1) {
                            const memberSeat = this.venue.seats[chromosome[memberIdx]];
                            const dist = this.getSeatDistance(seat, memberSeat);
                            score += Math.max(0, 100 - dist * 20); // Strong attraction
                        }
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestSeat = seatPos;
                }
            }

            if (bestSeat === -1) {
                for (let s = 0; s < this.venue.totalSeats; s++) {
                    if (!usedSeats.has(s)) { bestSeat = s; break; }
                }
            }

            chromosome[attendeeIdx] = bestSeat;
            usedSeats.add(bestSeat);
        }

        return chromosome;
    }

    calculateFitness(chromosome) {
        let friendProximityScore = 0;
        let vipPlacementScore = 0;
        let groupCohesionScore = 0;
        let stageDistanceScore = 0;

        let maxFriendScore = 0;
        let maxVipScore = 0;
        let maxGroupScore = 0;
        let maxDistanceScore = 0;

        // 1. Friend Proximity
        this.friendships.forEach((friends, attendeeIdx) => {
            const attendeeSeat = this.venue.seats[chromosome[attendeeIdx]];
            friends.forEach(friendIdx => {
                const friendSeat = this.venue.seats[chromosome[friendIdx]];
                const distance = this.getSeatDistance(attendeeSeat, friendSeat);

                maxFriendScore += 10;
                if (distance === 1) friendProximityScore += 10;
                else if (distance === 2) friendProximityScore += 7;
                else if (distance <= 4) friendProximityScore += 4;
                else friendProximityScore += Math.max(0, 2 - distance * 0.1);
            });
        });

        // Max possible distance for normalization
        const maxVenueDist = Math.sqrt(Math.pow(this.venue.rows + 1, 2) + Math.pow(this.venue.cols / 2, 2));

        // 2. VIP Placement & Stage Distance with Priority
        this.attendees.forEach((attendee, idx) => {
            const seat = this.venue.seats[chromosome[idx]];

            // VIP Scoring
            if (attendee.type === 'vip') {
                maxVipScore += 20;
                if (seat.isVip) vipPlacementScore += 20;
                else vipPlacementScore += Math.max(0, 10 - seat.row * 2);
            }

            // Stage Distance Scoring (Weighted by Priority)
            const priorityFactor = attendee.priority / 10; // 0.1 to 1.0
            const maxPointsForPerson = 10 * priorityFactor;

            maxDistanceScore += maxPointsForPerson;

            // Closer is better: distance ratio (1 is far, 0 is close)
            const distRatio = seat.distanceToStage / maxVenueDist;
            // Linearly decrease score as distance increases
            const personScore = Math.max(0, (1 - distRatio) * maxPointsForPerson);
            stageDistanceScore += personScore;
        });

        // 3. Group Cohesion
        this.groups.forEach((members) => {
            if (members.length <= 1) return;

            maxGroupScore += members.length * 10;
            const seats = members.map(idx => this.venue.seats[chromosome[idx]]);
            seats.sort((a, b) => a.row - b.row || a.col - b.col);

            let cohesionPoints = 0;
            // Check adjacency for every pair (more robust than just linear check)
            for (let i = 0; i < seats.length; i++) {
                for (let j = i + 1; j < seats.length; j++) {
                    const dist = this.getSeatDistance(seats[i], seats[j]);
                    if (dist === 1) cohesionPoints += 2;
                    else if (dist <= 2) cohesionPoints += 1;
                }
            }

            // Normalize: Perfect cohesion would have roughly (n-1) adjacencies in a line
            // or more in a block. We cap it.
            const maxPossible = (members.length - 1) * 2;
            groupCohesionScore += Math.min(members.length * 10, (cohesionPoints / Math.max(1, maxPossible)) * members.length * 10);
        });

        // Normalize scores 0-1
        const normFriend = maxFriendScore > 0 ? friendProximityScore / maxFriendScore : 1;
        const normVip = maxVipScore > 0 ? vipPlacementScore / maxVipScore : 1;
        const normGroup = maxGroupScore > 0 ? groupCohesionScore / maxGroupScore : 1;
        const normDistance = maxDistanceScore > 0 ? stageDistanceScore / maxDistanceScore : 1;

        const weights = this.config.weights;
        const totalWeight = weights.friendProximity + weights.vipPlacement + weights.groupCohesion + weights.stageDistance;

        return {
            total: ((normFriend * weights.friendProximity) +
                (normVip * weights.vipPlacement) +
                (normGroup * weights.groupCohesion) +
                (normDistance * weights.stageDistance)) / totalWeight,
            friendProximity: normFriend,
            vipPlacement: normVip,
            groupCohesion: normGroup,
            stageDistance: normDistance
        };
    }

    tournamentSelect(population, fitnessValues) {
        const tournamentSize = this.config.tournamentSize;
        let best = null;
        let bestFitness = -1;

        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * population.length);
            if (fitnessValues[idx].total > bestFitness) {
                bestFitness = fitnessValues[idx].total;
                best = population[idx];
            }
        }
        return [...best];
    }

    crossover(parent1, parent2) {
        if (Math.random() > this.config.crossoverRate) {
            return [[...parent1], [...parent2]];
        }

        const length = parent1.length;
        const start = Math.floor(Math.random() * length);
        const end = start + Math.floor(Math.random() * (length - start));

        const child1 = new Array(length).fill(-1);
        const child2 = new Array(length).fill(-1);

        for (let i = start; i <= end; i++) {
            child1[i] = parent1[i];
            child2[i] = parent2[i];
        }

        this.fillCrossoverChild(child1, parent2, start, end);
        this.fillCrossoverChild(child2, parent1, start, end);

        return [child1, child2];
    }

    fillCrossoverChild(child, parent, start, end) {
        const length = child.length;
        const usedSeats = new Set(child.filter(s => s !== -1));
        let childIdx = (end + 1) % length;
        let parentIdx = (end + 1) % length;

        while (child.includes(-1)) {
            if (!usedSeats.has(parent[parentIdx])) {
                child[childIdx] = parent[parentIdx];
                usedSeats.add(parent[parentIdx]);
                childIdx = (childIdx + 1) % length;
            }
            parentIdx = (parentIdx + 1) % length;
        }
    }

    mutate(chromosome) {
        // Adaptive mutation: higher rate in early generations or if stagnated
        const rate = this.config.mutationRate * (1 + Math.exp(-this.currentGeneration / 20)); // Decay

        if (Math.random() < rate) {
            // Swap two random positions
            const idx1 = Math.floor(Math.random() * chromosome.length);
            const idx2 = Math.floor(Math.random() * chromosome.length);
            [chromosome[idx1], chromosome[idx2]] = [chromosome[idx2], chromosome[idx1]];

            // Additional mutation: block swap (swap two segments)
            if (Math.random() < 0.3) {
                const len = Math.floor(Math.random() * 5) + 2;
                const start1 = Math.floor(Math.random() * (chromosome.length - len));
                const start2 = Math.floor(Math.random() * (chromosome.length - len));

                // Swap blocks
                for (let i = 0; i < len; i++) {
                    const temp = chromosome[start1 + i];
                    chromosome[start1 + i] = chromosome[start2 + i];
                    chromosome[start2 + i] = temp;
                }
            }
        }
        return chromosome;
    }

    smartMutate(chromosome, fitness) {
        const mutated = [...chromosome];
        if (fitness.friendProximity < 0.7 && Math.random() < 0.5) {
            this.improveFriendProximity(mutated);
        }
        if (fitness.vipPlacement < 0.8 && Math.random() < 0.5) {
            this.improveVipPlacement(mutated);
        }
        return mutated;
    }

    improveFriendProximity(chromosome) {
        for (const [attendeeIdx, friends] of this.friendships) {
            const attendeeSeat = this.venue.seats[chromosome[attendeeIdx]];
            for (const friendIdx of friends) {
                const friendSeat = this.venue.seats[chromosome[friendIdx]];
                if (this.getSeatDistance(attendeeSeat, friendSeat) > 3) {
                    this.trySwapForBetterProximity(chromosome, attendeeIdx, friendIdx);
                    return;
                }
            }
        }
    }

    trySwapForBetterProximity(chromosome, idx1, idx2) {
        const seat2 = this.venue.seats[chromosome[idx2]];
        for (let i = 0; i < chromosome.length; i++) {
            if (i === idx1 || i === idx2) continue;
            const otherSeat = this.venue.seats[chromosome[i]];
            if (this.getSeatDistance(otherSeat, seat2) === 1) {
                [chromosome[idx1], chromosome[i]] = [chromosome[i], chromosome[idx1]];
                return;
            }
        }
    }

    improveVipPlacement(chromosome) {
        for (let i = 0; i < this.attendees.length; i++) {
            if (this.attendees[i].type === 'vip') {
                const seat = this.venue.seats[chromosome[i]];
                if (!seat.isVip) {
                    for (let j = 0; j < this.attendees.length; j++) {
                        if (this.attendees[j].type !== 'vip') {
                            const otherSeat = this.venue.seats[chromosome[j]];
                            if (otherSeat.isVip) {
                                [chromosome[i], chromosome[j]] = [chromosome[j], chromosome[i]];
                                return;
                            }
                        }
                    }
                }
            }
        }
    }

    simulatedAnnealing(chromosome, iterations = 100) {
        let current = [...chromosome];
        let currentFitness = this.calculateFitness(current);
        let best = [...current];
        let bestFitness = currentFitness;
        let temp = this.config.initialTemp;

        for (let i = 0; i < iterations && temp > this.config.minTemp; i++) {
            const neighbor = [...current];

            // Smart neighbor generation - 50% chance to do targeted swap
            if (Math.random() < 0.5) {
                // Targeted swap: Try to improve weak areas
                const weakArea = this.findWeakArea(neighbor, currentFitness);
                if (weakArea) {
                    const { idx1, idx2 } = weakArea;
                    [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];
                } else {
                    // Random swap
                    const idx1 = Math.floor(Math.random() * neighbor.length);
                    const idx2 = Math.floor(Math.random() * neighbor.length);
                    [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];
                }
            } else {
                // Random swap
                const idx1 = Math.floor(Math.random() * neighbor.length);
                const idx2 = Math.floor(Math.random() * neighbor.length);
                [neighbor[idx1], neighbor[idx2]] = [neighbor[idx2], neighbor[idx1]];
            }

            const neighborFitness = this.calculateFitness(neighbor);
            const delta = neighborFitness.total - currentFitness.total;

            if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
                current = neighbor;
                currentFitness = neighborFitness;
                if (currentFitness.total > bestFitness.total) {
                    best = [...current];
                    bestFitness = currentFitness;
                }
            }
            temp *= this.config.coolingRate;
        }
        return { chromosome: best, fitness: bestFitness };
    }

    // Find a weak area in the current solution to target for improvement
    findWeakArea(chromosome, fitness) {
        // If VIP placement is weak, find a VIP not in VIP rows and try to swap
        if (fitness.vipPlacement < 0.8) {
            for (let i = 0; i < this.attendees.length; i++) {
                if (this.attendees[i].type === 'vip') {
                    const seat = this.venue.seats[chromosome[i]];
                    if (!seat.isVip) {
                        // Find someone in VIP row who is not VIP
                        for (let j = 0; j < this.attendees.length; j++) {
                            if (this.attendees[j].type !== 'vip') {
                                const otherSeat = this.venue.seats[chromosome[j]];
                                if (otherSeat.isVip) {
                                    return { idx1: i, idx2: j };
                                }
                            }
                        }
                    }
                }
            }
        }

        // If group cohesion is weak, try to move group members closer
        if (fitness.groupCohesion < 0.7) {
            for (const [groupName, members] of this.groups) {
                if (members.length <= 1) continue;
                // Find an isolated member
                for (const memberIdx of members) {
                    const memberSeat = this.venue.seats[chromosome[memberIdx]];
                    let hasNeighbor = false;
                    for (const otherIdx of members) {
                        if (otherIdx === memberIdx) continue;
                        const otherSeat = this.venue.seats[chromosome[otherIdx]];
                        if (this.getSeatDistance(memberSeat, otherSeat) <= 2) {
                            hasNeighbor = true;
                            break;
                        }
                    }
                    if (!hasNeighbor) {
                        // Find someone adjacent to a group member to swap with
                        for (const otherIdx of members) {
                            if (otherIdx === memberIdx) continue;
                            const otherSeat = this.venue.seats[chromosome[otherIdx]];
                            // Find adjacent seat
                            for (let k = 0; k < this.attendees.length; k++) {
                                if (!members.includes(k)) {
                                    const kSeat = this.venue.seats[chromosome[k]];
                                    if (this.getSeatDistance(otherSeat, kSeat) === 1) {
                                        return { idx1: memberIdx, idx2: k };
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    initializePopulation() {
        const population = [];
        for (let i = 0; i < Math.floor(this.config.populationSize * 0.2); i++) {
            const greedy = this.generateGreedySolution();
            for (let j = 0; j < 5; j++) this.mutate(greedy);
            population.push(greedy);
        }
        while (population.length < this.config.populationSize) {
            population.push(this.generateRandomChromosome());
        }
        return population;
    }

    async optimize(progressCallback = null, completeCallback = null) {
        if (!this.venue || this.attendees.length === 0) throw new Error('Venue/Attendees not set');

        this.isRunning = true;
        this.fitnessHistory = [];

        const mode = this.config.mode || 'balanced';
        const totalGenerations = mode === 'fast' ? 50 : (mode === 'thorough' ? 500 : this.config.generations);
        const saIterations = mode === 'fast' ? 20 : (mode === 'thorough' ? 200 : 100);

        let population = this.initializePopulation();
        let fitnessValues = population.map(c => this.calculateFitness(c));

        let bestIdx = 0;
        for (let i = 1; i < fitnessValues.length; i++) {
            if (fitnessValues[i].total > fitnessValues[bestIdx].total) bestIdx = i;
        }
        this.bestSolution = [...population[bestIdx]];
        this.bestFitness = fitnessValues[bestIdx];

        for (let gen = 0; gen < totalGenerations && this.isRunning; gen++) {
            this.currentGeneration = gen;
            const sorted = population.map((c, i) => ({ chromosome: c, fitness: fitnessValues[i] }))
                .sort((a, b) => b.fitness.total - a.fitness.total);

            const newPopulation = [];
            for (let i = 0; i < this.config.elitismCount; i++) newPopulation.push([...sorted[i].chromosome]);

            while (newPopulation.length < this.config.populationSize) {
                const p1 = this.tournamentSelect(population, fitnessValues);
                const p2 = this.tournamentSelect(population, fitnessValues);
                let [c1, c2] = this.crossover(p1, p2);
                c1 = this.mutate(c1); c2 = this.mutate(c2);

                if (Math.random() < 0.3) {
                    c1 = this.smartMutate(c1, this.calculateFitness(c1));
                }

                newPopulation.push(c1);
                if (newPopulation.length < this.config.populationSize) newPopulation.push(c2);
            }

            population = newPopulation;
            fitnessValues = population.map(c => this.calculateFitness(c));

            for (let i = 0; i < fitnessValues.length; i++) {
                if (fitnessValues[i].total > this.bestFitness.total) {
                    this.bestSolution = [...population[i]];
                    this.bestFitness = fitnessValues[i];
                }
            }
            this.fitnessHistory.push(this.bestFitness.total);

            if (progressCallback) {
                progressCallback({
                    generation: gen,
                    totalGenerations,
                    bestFitness: this.bestFitness,
                    progress: (gen + 1) / totalGenerations
                });
            }
            if (gen % 5 === 0) await new Promise(r => setTimeout(r, 0));
        }

        if (this.isRunning) {
            const refined = this.simulatedAnnealing(this.bestSolution, saIterations);
            if (refined.fitness.total > this.bestFitness.total) {
                this.bestSolution = refined.chromosome;
                this.bestFitness = refined.fitness;
            }
        }

        this.isRunning = false;
        if (completeCallback) {
            completeCallback({
                solution: this.bestSolution,
                fitness: this.bestFitness,
                history: this.fitnessHistory
            });
        }

        return { solution: this.bestSolution, fitness: this.bestFitness, history: this.fitnessHistory };
    }

    stop() { this.isRunning = false; }

    getSeatingPlan(solution = null) {
        const chromosome = solution || this.bestSolution;
        if (!chromosome) return null;

        return this.attendees.map((attendee, idx) => {
            const seat = this.venue.seats[chromosome[idx]];
            return {
                attendee,
                seat: {
                    row: seat.row, col: seat.col,
                    rowLabel: String.fromCharCode(65 + seat.row),
                    seatNumber: seat.col + 1, isVip: seat.isVip,
                    seatId: `${String.fromCharCode(65 + seat.row)}${seat.col + 1}`
                }
            };
        });
    }

    updateWeights(friend, vip, group, distance) {
        const total = friend + vip + group + distance;
        this.config.weights = {
            friendProximity: friend / total,
            vipPlacement: vip / total,
            groupCohesion: group / total,
            stageDistance: distance / total
        };
    }

    setMode(mode) { this.config.mode = mode; }
}

window.SeatOptimizer = SeatOptimizer;
