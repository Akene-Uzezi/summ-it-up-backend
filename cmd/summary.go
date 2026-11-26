package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (a *application) summarize(c *gin.Context) {
	var req summaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
}
