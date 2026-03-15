# Cline MCP Marketplace Submission Template

This document provides a template and checklist for submitting MCP Local Helper to the Cline MCP Marketplace.

## Pre-Submission Checklist

Before creating your submission issue, ensure all of the following are complete:

### Documentation
- [x] README.md is comprehensive with installation instructions
- [x] llms-install.md exists with agent-friendly setup guide
- [x] License file matches package.json declaration (Apache 2.0)
- [ ] Logo created (400×400 PNG) - **ACTION REQUIRED**

### Repository Quality
- [ ] GitHub repository is public and accessible
- [ ] Code follows best practices with no obvious security issues
- [ ] Test suite passes (`npm test`)
- [ ] Recent commit activity showing active maintenance

### Verification
- [ ] Cline can successfully auto-setup the server from README + llms-install.md
- [ ] All four tools work correctly after installation
- [ ] LM Studio integration functions as expected

## Submission Issue Template

Copy and customize this template when creating your issue in the `cline/mcp-marketplace` repository:

---

**Issue Title:** Add MCP Local Helper - Intelligent Model Management for LM Studio

### GitHub Repo URL
https://github.com/mperdum/leanzero-mcp-local-helper

### Logo
[Attach 400×400 PNG logo here]

### Reason for Addition

MCP Local Helper is an intelligent model management system that brings automatic model selection and task routing to LM Studio through the Model Context Protocol (MCP). It addresses a critical need in local AI workflows: efficiently managing multiple models based on their actual performance for different task types.

**Key Benefits for Cline Users:**

1. **Automatic Model Optimization**: The DNA-based configuration system tracks model effectiveness across different task types (code fixes, feature architecture, research, etc.) and automatically routes tasks to the best-performing model.

2. **Intelligent Task Routing**: Tasks are classified by intent and executed with the most appropriate model, with automatic fallback mechanisms ensuring high availability even when individual models encounter issues.

3. **Continuous Improvement**: The evolution engine analyzes usage patterns and ratings over time, suggesting configuration improvements and automatically applying optimizations when thresholds are met.

4. **Resource Efficiency**: Models can be loaded/unloaded on demand based on task requirements, optimizing memory usage for systems with limited resources.

5. **Four Powerful Tools**:
   - `switch-model`: Manual control over model lifecycle (load, unload, list)
   - `execute-task`: Automatic task execution with intelligent model selection
   - `model-dna`: Configuration management and evolution
   - `rate-model`: Performance feedback for continuous optimization

**Why This is Different:**
Unlike simple model switchers, MCP Local Helper learns from actual usage patterns. It doesn't just let you choose models—it helps you discover which models work best for your specific workflows and automatically optimizes assignments based on real performance data.

**Installation Verification:**
I have tested giving Cline the README.md and llms-install.md files, and it successfully:
1. Cloned the repository
2. Installed dependencies with `npm install`
3. Ran tests to verify installation
4. Configured the MCP client settings
5. Initialized the Model DNA configuration
6. Executed tasks through all four tools

### Additional Information

- **License**: Apache 2.0
- **Node.js Version**: >= 18.0.0
- **Dependencies**: Minimal (only `@modelcontextprotocol/sdk` and `zod`)
- **Test Coverage**: Comprehensive test suite covering all major components
- **Documentation**: Full README with architecture overview, plus detailed phase documentation in `/docs/`

---

## Logo Requirements

The Cline MCP Marketplace requires a 400×400 PNG logo. Here are guidelines for creating one:

### Specifications
- **Dimensions**: Exactly 400×400 pixels
- **Format**: PNG with transparency support
- **Style**: Clean, professional, recognizable at small sizes
- **Content**: Should represent the concept of intelligent model management or DNA-based configuration

### Design Ideas
1. **DNA Helix + Model Icon**: A stylized DNA double helix intertwined with a neural network or AI brain icon
2. **Switch/Routing Visual**: Arrows routing to different nodes, representing task distribution across models
3. **Abstract "MCP" Letters**: Creative typography incorporating the MCP acronym with local/helper themes

### Tools for Creating Logo
- **Figma** (free): https://figma.com
- **Canva** (free tier available): https://canva.com
- **Inkscape** (free, open-source): https://inkscape.org
- **GIMP** (free, open-source): https://gimp.org

## Submission Process

1. **Prepare the Logo**: Create and save your 400×400 PNG logo file

2. **Navigate to the Marketplace Repository**: Go to https://github.com/cline/mcp-marketplace

3. **Create a New Issue**: Click "Issues" → "New issue"

4. **Fill in the Template**: Use the template above, attaching your logo image directly to the issue

5. **Submit**: Review and submit the issue

6. **Wait for Review**: The Cline team aims to review submissions within a couple of days

7. **Respond to Feedback**: If reviewers request changes or clarifications, respond promptly

## Post-Acceptance Actions

Once your submission is approved:

1. **Add Marketplace Badge**: Consider adding a "Available on Cline MCP Marketplace" badge to your README
2. **Monitor Issues**: Watch for user feedback and issues related to marketplace installations
3. **Keep Updated**: Maintain the repository with regular commits to show active maintenance
4. **Engage Community**: Respond to questions in the Cline Discord #mcp channel if users need help

## FAQ

**Q: What if my submission is rejected?**
A: The reviewers will provide feedback on what needs improvement. Common reasons include insufficient documentation, unclear value proposition, or security concerns. Address the feedback and resubmit.

**Q: How long does approval take?**
A: The Cline team aims to review within a couple of days, but this may vary based on submission volume.

**Q: Can I update my listing after it's approved?**
A: Yes, improvements to your repository are automatically reflected. For major changes or logo updates, you can request modifications through the marketplace maintainers.

**Q: Do I need many GitHub stars to be accepted?**
A: No, the marketplace accepts quality projects regardless of star count. However, community adoption is one factor in the review process.

## Contact

For questions about the submission process, join the Cline Discord and post in the #mcp channel: https://discord.gg/cline