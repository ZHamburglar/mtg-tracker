#!/bin/bash

# Local Development Helper Script
# This script helps manage local development for the collection service

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}MTG Tracker Collection - Local Dev Helper${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    echo "Please install kubectl to continue"
    exit 1
fi

# Check if MySQL port-forward is already running
check_port_forward() {
    if lsof -Pi :3306 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✓ MySQL port-forward is running on port 3306${NC}"
        return 0
    else
        echo -e "${YELLOW}! MySQL port-forward is NOT running${NC}"
        return 1
    fi
}

# Start MySQL port-forward
start_port_forward() {
    echo -e "${YELLOW}Starting MySQL port-forward...${NC}"
    echo "This will run in the background. Check logs with: jobs"
    kubectl port-forward svc/mysql 3306:3306 > /tmp/mysql-port-forward.log 2>&1 &
    PF_PID=$!
    echo $PF_PID > /tmp/mysql-port-forward.pid
    sleep 2
    
    if check_port_forward; then
        echo -e "${GREEN}✓ Port-forward started successfully (PID: $PF_PID)${NC}"
    else
        echo -e "${RED}✗ Failed to start port-forward${NC}"
        exit 1
    fi
}

# Stop MySQL port-forward
stop_port_forward() {
    if [ -f /tmp/mysql-port-forward.pid ]; then
        PF_PID=$(cat /tmp/mysql-port-forward.pid)
        if ps -p $PF_PID > /dev/null 2>&1; then
            kill $PF_PID
            rm /tmp/mysql-port-forward.pid
            echo -e "${GREEN}✓ Stopped MySQL port-forward (PID: $PF_PID)${NC}"
        else
            echo -e "${YELLOW}! Port-forward process not found${NC}"
            rm /tmp/mysql-port-forward.pid
        fi
    else
        # Try to find and kill any kubectl port-forward on 3306
        PF_PID=$(lsof -t -i:3306 -sTCP:LISTEN 2>/dev/null || echo "")
        if [ -n "$PF_PID" ]; then
            kill $PF_PID
            echo -e "${GREEN}✓ Stopped port-forward on port 3306${NC}"
        else
            echo -e "${YELLOW}! No port-forward found running on port 3306${NC}"
        fi
    fi
}

# Check MySQL connection
test_mysql() {
    echo -e "${YELLOW}Testing MySQL connection...${NC}"
    if check_port_forward; then
        # Try to connect using mysql client if available
        if command -v mysql &> /dev/null; then
            mysql -h localhost -u mtguser -pmtgpassword123 -e "SELECT 1;" mtgtrackerdb > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ MySQL connection successful${NC}"
            else
                echo -e "${RED}✗ MySQL connection failed${NC}"
                echo "Check credentials in .env.local"
            fi
        else
            echo -e "${YELLOW}! mysql client not installed, skipping connection test${NC}"
        fi
    else
        echo -e "${RED}✗ Port-forward not running${NC}"
    fi
}

# Check deployed services
check_services() {
    echo -e "${YELLOW}Checking deployed services...${NC}"
    
    # Check if mtg-tracker.local resolves
    if grep -q "mtg-tracker.local" /etc/hosts; then
        echo -e "${GREEN}✓ /etc/hosts configured for mtg-tracker.local${NC}"
    else
        echo -e "${RED}✗ mtg-tracker.local not in /etc/hosts${NC}"
        echo "Add this line to /etc/hosts:"
        echo "127.0.0.1 mtg-tracker.local"
    fi
    
    # Check search service
    if curl -s -k https://mtg-tracker.local/api/search/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Search service is reachable${NC}"
    else
        echo -e "${RED}✗ Search service not reachable${NC}"
    fi
    
    # Check auth service
    if curl -s -k https://mtg-tracker.local/api/users/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Auth service is reachable${NC}"
    else
        echo -e "${YELLOW}! Auth service not reachable (may not have health endpoint)${NC}"
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "What would you like to do?"
    echo "1) Start port-forward and run service"
    echo "2) Just start port-forward"
    echo "3) Stop port-forward"
    echo "4) Check status"
    echo "5) Test MySQL connection"
    echo "6) Check deployed services"
    echo "7) View logs"
    echo "8) Exit"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Select option [1-8]: " choice
    
    case $choice in
        1)
            if ! check_port_forward; then
                start_port_forward
            fi
            echo ""
            echo -e "${GREEN}Starting local development server...${NC}"
            echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
            npm run dev:local
            ;;
        2)
            if check_port_forward; then
                echo -e "${YELLOW}Port-forward is already running${NC}"
            else
                start_port_forward
            fi
            ;;
        3)
            stop_port_forward
            ;;
        4)
            check_port_forward
            if [ -f /tmp/mysql-port-forward.pid ]; then
                echo "Port-forward PID: $(cat /tmp/mysql-port-forward.pid)"
            fi
            ;;
        5)
            test_mysql
            ;;
        6)
            check_services
            ;;
        7)
            if [ -f /tmp/mysql-port-forward.log ]; then
                echo -e "${YELLOW}Port-forward logs:${NC}"
                tail -20 /tmp/mysql-port-forward.log
            else
                echo -e "${YELLOW}No logs found${NC}"
            fi
            ;;
        8)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
done
