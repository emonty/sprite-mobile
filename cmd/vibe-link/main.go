package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"

	"github.com/gorilla/websocket"
	"golang.org/x/term"
)

const version = "1.0.0"

type Config struct {
	BaseURL string
	APIKey  string
}

type CreateSpriteRequest struct {
	Name string `json:"name"`
}

type CreateSpriteResponse struct {
	Success   bool   `json:"success"`
	Name      string `json:"name"`
	PublicURL string `json:"publicUrl,omitempty"`
	Output    string `json:"output,omitempty"`
	Error     string `json:"error,omitempty"`
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "create":
		createCommand()
	case "console":
		consoleCommand()
	case "version":
		fmt.Printf("vibe-link version %s\n", version)
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`vibe-link - CLI utility for Sprite Console API

Usage:
  vibe-link <command> [options]

Commands:
  create <name>              Create a new sprite
  console <name>             Connect to a sprite's console
  version                    Show version information
  help                       Show this help message

Create Options:
  -url <base-url>            Base URL (default: http://localhost:8081)
  -key <api-key>             API key (or set SPRITE_API_KEY env var)

Console Options:
  -url <base-url>            Base URL (default: ws://localhost:8081)
  -key <api-key>             API key (or set SPRITE_API_KEY env var)

Environment Variables:
  SPRITE_API_KEY             API key for authentication
  SPRITE_API_URL             Base URL for API

Examples:
  # Create a new sprite
  vibe-link create my-new-sprite -key sk_test_12345

  # Connect to sprite console
  vibe-link console my-sprite -key sk_test_12345

  # Using environment variables
  export SPRITE_API_KEY=sk_test_12345
  export SPRITE_API_URL=https://my-sprite.fly.dev
  vibe-link create my-new-sprite
  vibe-link console my-sprite
`)
}

func createCommand() {
	createFlags := flag.NewFlagSet("create", flag.ExitOnError)
	baseURL := createFlags.String("url", getEnvOrDefault("SPRITE_API_URL", "http://localhost:8081"), "Base URL")
	apiKey := createFlags.String("key", os.Getenv("SPRITE_API_KEY"), "API key")

	createFlags.Parse(os.Args[2:])

	if createFlags.NArg() < 1 {
		fmt.Fprintln(os.Stderr, "Error: sprite name required")
		fmt.Fprintln(os.Stderr, "Usage: vibe-link create <name> [-url <base-url>] [-key <api-key>]")
		os.Exit(1)
	}

	spriteName := createFlags.Arg(0)

	if *apiKey == "" {
		fmt.Fprintln(os.Stderr, "Error: API key required (use -key flag or SPRITE_API_KEY env var)")
		os.Exit(1)
	}

	if !isValidAPIKey(*apiKey) {
		fmt.Fprintln(os.Stderr, "Error: API key must start with 'sk_' or 'rk_'")
		os.Exit(1)
	}

	config := Config{
		BaseURL: *baseURL,
		APIKey:  *apiKey,
	}

	if err := createSprite(config, spriteName); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func consoleCommand() {
	consoleFlags := flag.NewFlagSet("console", flag.ExitOnError)
	baseURL := consoleFlags.String("url", getEnvOrDefault("SPRITE_API_URL", "ws://localhost:8081"), "Base URL")
	apiKey := consoleFlags.String("key", os.Getenv("SPRITE_API_KEY"), "API key")

	consoleFlags.Parse(os.Args[2:])

	if consoleFlags.NArg() < 1 {
		fmt.Fprintln(os.Stderr, "Error: sprite name required")
		fmt.Fprintln(os.Stderr, "Usage: vibe-link console <name> [-url <base-url>] [-key <api-key>]")
		os.Exit(1)
	}

	spriteName := consoleFlags.Arg(0)

	if *apiKey == "" {
		fmt.Fprintln(os.Stderr, "Error: API key required (use -key flag or SPRITE_API_KEY env var)")
		os.Exit(1)
	}

	if !isValidAPIKey(*apiKey) {
		fmt.Fprintln(os.Stderr, "Error: API key must start with 'sk_' or 'rk_'")
		os.Exit(1)
	}

	config := Config{
		BaseURL: *baseURL,
		APIKey:  *apiKey,
	}

	if err := connectConsole(config, spriteName); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func createSprite(config Config, spriteName string) error {
	fmt.Printf("Creating sprite: %s\n", spriteName)

	reqBody := CreateSpriteRequest{
		Name: spriteName,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	apiURL := fmt.Sprintf("%s/api/sprites/create", config.BaseURL)
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Add Basic Auth header
	auth := base64.StdEncoding.EncodeToString([]byte(config.APIKey + ":x"))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == 401 {
		return fmt.Errorf("unauthorized: invalid API key")
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result CreateSpriteResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !result.Success {
		fmt.Printf("✗ Failed to create sprite\n")
		if result.Error != "" {
			fmt.Printf("Error: %s\n", result.Error)
		}
		if result.Output != "" {
			fmt.Printf("\nOutput:\n%s\n", result.Output)
		}
		return fmt.Errorf("sprite creation failed")
	}

	fmt.Printf("✓ Sprite created successfully: %s\n", result.Name)
	if result.PublicURL != "" {
		fmt.Printf("Public URL: %s\n", result.PublicURL)
	}

	if result.Output != "" {
		fmt.Printf("\nOutput:\n%s\n", result.Output)
	}

	return nil
}

func connectConsole(config Config, spriteName string) error {
	// Convert HTTP(S) URL to WS(S)
	wsURL := config.BaseURL
	if len(wsURL) > 4 && wsURL[:4] == "http" {
		if wsURL[:5] == "https" {
			wsURL = "wss" + wsURL[5:]
		} else {
			wsURL = "ws" + wsURL[4:]
		}
	}

	// Build WebSocket URL
	u, err := url.Parse(fmt.Sprintf("%s/api/sprites/%s/console", wsURL, url.PathEscape(spriteName)))
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	fmt.Printf("Connecting to %s console...\n", spriteName)

	// Create WebSocket dialer with auth header
	header := http.Header{}
	auth := base64.StdEncoding.EncodeToString([]byte(config.APIKey + ":x"))
	header.Set("Authorization", "Basic "+auth)

	// Connect to WebSocket
	conn, resp, err := websocket.DefaultDialer.Dial(u.String(), header)
	if err != nil {
		if resp != nil {
			if resp.StatusCode == 401 {
				return fmt.Errorf("unauthorized: invalid API key")
			}
			return fmt.Errorf("connection failed with status %d: %w", resp.StatusCode, err)
		}
		return fmt.Errorf("connection failed: %w", err)
	}
	defer conn.Close()

	fmt.Printf("✓ Connected to %s console\n", spriteName)
	fmt.Println("---")

	// Put terminal in raw mode
	oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		return fmt.Errorf("failed to set terminal to raw mode: %w", err)
	}
	defer term.Restore(int(os.Stdin.Fd()), oldState)

	// Handle interrupt signal to restore terminal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		term.Restore(int(os.Stdin.Fd()), oldState)
		os.Exit(0)
	}()

	// Channel for errors
	errChan := make(chan error, 2)

	// Goroutine to read from WebSocket and write to stdout
	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				errChan <- fmt.Errorf("websocket read error: %w", err)
				return
			}
			os.Stdout.Write(message)
		}
	}()

	// Goroutine to read from stdin and write to WebSocket
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := os.Stdin.Read(buf)
			if err != nil {
				errChan <- fmt.Errorf("stdin read error: %w", err)
				return
			}
			if n > 0 {
				err = conn.WriteMessage(websocket.BinaryMessage, buf[:n])
				if err != nil {
					errChan <- fmt.Errorf("websocket write error: %w", err)
					return
				}
			}
		}
	}()

	// Wait for error or interrupt
	err = <-errChan
	fmt.Fprintf(os.Stderr, "\n%v\n", err)

	return nil
}

func isValidAPIKey(key string) bool {
	return len(key) > 3 && (key[:3] == "sk_" || key[:3] == "rk_")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
